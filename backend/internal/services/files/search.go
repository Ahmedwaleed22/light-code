package files

import (
	"bytes"
	"container/list"
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

const (
	searchCacheBytes = 4 << 20
	searchCacheFiles = 4096
	// Large files are scanned without displacing the small source files from the cache.
	maxCachedFile = 128 << 10
)

type searchFile struct {
	path   string
	info   fs.FileInfo
	text   []byte
	folded []byte
}

func (f *searchFile) cost() int { return cap(f.text) + cap(f.folded) + len(f.path) + 256 }

type searchCache struct {
	mu         sync.Mutex
	entries    map[string]*list.Element
	lru        list.List
	bytes      int
	generation uint64
}

func sameFile(a, b fs.FileInfo) bool {
	return a.Size() == b.Size() && a.Mode() == b.Mode() && a.ModTime() == b.ModTime() && os.SameFile(a, b)
}

func (c *searchCache) get(path string, info fs.FileInfo) (*searchFile, uint64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if entry := c.entries[path]; entry != nil {
		file := entry.Value.(*searchFile)
		if sameFile(file.info, info) {
			c.lru.MoveToFront(entry)
			return file, c.generation
		}
		c.remove(entry)
	}
	return nil, c.generation
}

func (c *searchCache) remove(entry *list.Element) {
	file := entry.Value.(*searchFile)
	delete(c.entries, file.path)
	c.bytes -= file.cost()
	c.lru.Remove(entry)
}

func (c *searchCache) put(file *searchFile, generation uint64) {
	if len(file.text) > maxCachedFile || file.cost() > searchCacheBytes {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	// A save or tree change during the disk read must not repopulate an invalidated entry.
	if c.generation != generation {
		return
	}
	if c.entries == nil {
		c.entries = make(map[string]*list.Element)
	}
	if old := c.entries[file.path]; old != nil {
		c.remove(old)
	}
	for c.bytes+file.cost() > searchCacheBytes || len(c.entries) >= searchCacheFiles {
		c.remove(c.lru.Back())
	}
	c.entries[file.path] = c.lru.PushFront(file)
	c.bytes += file.cost()
}

func (c *searchCache) invalidate(path string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.generation++
	if entry := c.entries[path]; entry != nil {
		c.remove(entry)
	}
	// Directory renames/deletes invalidate descendants as well.
	for name, entry := range c.entries {
		if strings.HasPrefix(name, path+"/") {
			c.remove(entry)
		}
	}
}

// Search caches text and its case-folded form under a fixed memory budget. Directory
// metadata is still checked on every query so edits made outside the app are discovered.
func (s *Service) Search(ctx context.Context, query string, limit int) (matches []Match, truncated bool, err error) {
	matches = []Match{}
	if err := ctx.Err(); err != nil {
		return matches, false, err
	}
	if query == "" {
		return matches, false, nil
	}
	select {
	case s.searchSlot <- struct{}{}:
		defer func() { <-s.searchSlot }()
	case <-ctx.Done():
		return matches, false, ctx.Err()
	}
	needle := bytes.ToLower([]byte(query))
	err = s.walk(ctx, func(rel string, item fs.DirEntry) error {
		info, err := item.Info()
		if err != nil || info.Size() > MaxFileSize {
			return nil
		}
		file, generation := s.search.get(rel, info)
		if file == nil {
			full, err := s.resolve(rel, false)
			if err != nil {
				return nil
			}
			text, readInfo, err := readContents(full)
			if err != nil || bytes.IndexByte(text, 0) >= 0 {
				return nil
			}
			file = &searchFile{path: rel, info: readInfo, text: text, folded: bytes.ToLower(text)}
			// Don't cache a file that was replaced or changed while it was read.
			if after, err := os.Lstat(filepath.Join(s.root, filepath.FromSlash(rel))); err == nil && sameFile(readInfo, after) {
				s.search.put(file, generation)
			}
		}
		if err := ctx.Err(); err != nil {
			return err
		}
		if !bytes.Contains(file.folded, needle) {
			return nil
		}
		// Lowercasing Unicode can change byte lengths. Walk both versions by newline
		// rather than using folded byte offsets to slice the original text.
		original, folded := file.text, file.folded
		for line := 1; len(original) > 0; line++ {
			if err := ctx.Err(); err != nil {
				return err
			}
			text, rest, _ := bytes.Cut(original, []byte{'\n'})
			lower, lowerRest, _ := bytes.Cut(folded, []byte{'\n'})
			original, folded = rest, lowerRest
			if !bytes.Contains(lower, needle) {
				continue
			}
			if len(matches) >= limit {
				truncated = true
				return fs.SkipAll
			}
			preview := bytes.TrimSpace(text)
			if len(preview) > 240 {
				preview = preview[:240]
			}
			matches = append(matches, Match{Path: rel, Line: line, Text: strings.ToValidUTF8(string(preview), "")})
		}
		return nil
	})
	return matches, truncated, err
}
