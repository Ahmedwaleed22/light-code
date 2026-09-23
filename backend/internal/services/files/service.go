package files

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"hash/fnv"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"unicode/utf8"

	"project/backend/internal/events"
)

const MaxFileSize = 2 << 20 // Keep browser and server memory predictable.

var (
	ErrInvalidPath = errors.New("invalid path")
	ErrNotFound    = errors.New("file not found")
	ErrTooLarge    = errors.New("file exceeds 2 MiB limit")
	ErrConflict    = errors.New("file changed since it was opened")
	ErrExists      = errors.New("file already exists")
	ErrBinary      = errors.New("file is not valid UTF-8 text")
	ErrNotDir      = errors.New("not a directory")
)

// skippedDirs are never walked by the index or search; the explorer still lists them lazily.
var skippedDirs = map[string]bool{".git": true, "node_modules": true}

// tempPrefix marks in-progress atomic saves; they are hidden from listings.
const tempPrefix = ".light-code-save-"

type Entry struct {
	Path string `json:"path"`
	Name string `json:"name"`
	Kind string `json:"kind"`
}

type Document struct {
	Path    string `json:"path"`
	Content string `json:"content"`
	Version string `json:"version"`
}

type Service struct {
	root string
	bus  events.Bus
	// tree is held exclusively by rename and delete; saves share it and then lock their own stripe,
	// so saves to different files run in parallel while saves to one file stay ordered.
	tree    sync.RWMutex
	stripes [64]sync.Mutex
	search  searchCache
	// Only one workspace scan runs at a time, without blocking reads or saves.
	searchSlot chan struct{}
}

func (s *Service) lockPath(path string) func() {
	hash := fnv.New32a()
	_, _ = hash.Write([]byte(path))
	stripe := &s.stripes[hash.Sum32()%uint32(len(s.stripes))]
	s.tree.RLock()
	stripe.Lock()
	return func() {
		stripe.Unlock()
		s.tree.RUnlock()
	}
}

func New(root string, bus events.Bus) (*Service, error) {
	absolute, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(absolute, 0755); err != nil {
		return nil, err
	}
	return &Service{root: absolute, bus: bus, searchSlot: make(chan struct{}, 1)}, nil
}

// resolve accepts slash-separated relative paths and rejects symlinks in every component.
func (s *Service) resolve(path string, allowMissing bool) (string, error) {
	if path == "" {
		return "", ErrInvalidPath
	}
	if strings.ContainsRune(path, 0) || strings.Contains(path, "\\") || strings.HasPrefix(path, "/") {
		return "", ErrInvalidPath
	}
	clean := filepath.Clean(filepath.FromSlash(path))
	if clean == "." || clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) || filepath.ToSlash(clean) != path {
		return "", ErrInvalidPath
	}
	current := s.root
	parts := strings.Split(clean, string(filepath.Separator))
	for i, part := range parts {
		current = filepath.Join(current, part)
		info, err := os.Lstat(current)
		if errors.Is(err, fs.ErrNotExist) {
			if allowMissing && i == len(parts)-1 {
				return current, nil
			}
			return "", ErrNotFound
		}
		if err != nil {
			return "", err
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return "", ErrInvalidPath
		}
		if i < len(parts)-1 && !info.IsDir() {
			return "", ErrInvalidPath
		}
	}
	return current, nil
}

// ListDir returns the direct children of dir ("" is the workspace root), directories first.
func (s *Service) ListDir(dir string) ([]Entry, error) {
	full := s.root
	if dir != "" {
		var err error
		if full, err = s.resolve(dir, false); err != nil {
			return nil, err
		}
	}
	items, err := os.ReadDir(full)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, ErrNotFound
	}
	if err != nil {
		if info, statErr := os.Stat(full); statErr == nil && !info.IsDir() {
			return nil, ErrNotDir
		}
		return nil, err
	}
	entries := make([]Entry, 0, len(items))
	for _, item := range items {
		if item.Type()&os.ModeSymlink != 0 || item.Name() == ".git" || strings.HasPrefix(item.Name(), tempPrefix) {
			continue
		}
		kind := "file"
		if item.IsDir() {
			kind = "directory"
		}
		entries = append(entries, Entry{Path: join(dir, item.Name()), Name: item.Name(), Kind: kind})
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Kind != entries[j].Kind {
			return entries[i].Kind == "directory"
		}
		return strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name)
	})
	return entries, nil
}

// Index returns up to limit file paths for quick open, skipping dependency and VCS folders.
func (s *Service) Index(ctx context.Context, limit int) (paths []string, truncated bool, err error) {
	paths = []string{}
	err = s.walk(ctx, func(rel string, _ fs.DirEntry) error {
		if len(paths) >= limit {
			truncated = true
			return fs.SkipAll
		}
		paths = append(paths, rel)
		return nil
	})
	return paths, truncated, err
}

type Match struct {
	Path string `json:"path"`
	Line int    `json:"line"`
	Text string `json:"text"`
}

func (s *Service) walk(ctx context.Context, visit func(rel string, item fs.DirEntry) error) error {
	err := filepath.WalkDir(s.root, func(path string, item fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			if path == s.root {
				return walkErr
			}
			return nil // Skip unreadable entries rather than failing the whole walk.
		}
		if err := ctx.Err(); err != nil {
			return err
		}
		if path == s.root || item.Type()&os.ModeSymlink != 0 {
			return nil
		}
		if item.IsDir() {
			if skippedDirs[item.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		if !item.Type().IsRegular() || strings.HasPrefix(item.Name(), tempPrefix) {
			return nil
		}
		rel, err := filepath.Rel(s.root, path)
		if err != nil {
			return err
		}
		return visit(filepath.ToSlash(rel), item)
	})
	if errors.Is(err, fs.SkipAll) {
		return nil
	}
	return err
}

func (s *Service) Read(path string) (Document, error) {
	full, err := s.resolve(path, false)
	if err != nil {
		return Document{}, err
	}
	data, _, err := readContents(full)
	if err != nil {
		return Document{}, err
	}
	return Document{Path: path, Content: string(data), Version: version(data)}, nil
}

// Allocate for the known file size once instead of growing io.ReadAll's buffer repeatedly.
// The extra byte and bounded tail also catch files that grow while being read.
func readContents(full string) ([]byte, fs.FileInfo, error) {
	file, err := os.Open(full)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil, ErrNotFound
	}
	if err != nil {
		return nil, nil, err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return nil, nil, err
	}
	if !info.Mode().IsRegular() {
		return nil, nil, ErrInvalidPath
	}
	if info.Size() > MaxFileSize {
		return nil, nil, ErrTooLarge
	}
	data := make([]byte, info.Size()+1)
	n, err := io.ReadFull(file, data)
	if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
		return nil, nil, err
	}
	data = data[:n]
	if err == nil {
		tail, err := io.ReadAll(io.LimitReader(file, int64(MaxFileSize+1-n)))
		if err != nil {
			return nil, nil, err
		}
		data = append(data, tail...)
	}
	if len(data) > MaxFileSize {
		return nil, nil, ErrTooLarge
	}
	if !utf8.Valid(data) {
		return nil, nil, ErrBinary
	}
	return data, info, nil
}

func (s *Service) Create(ctx context.Context, path string) error {
	full, err := s.resolve(path, true)
	if err != nil {
		return err
	}
	file, err := os.OpenFile(full, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0644)
	if errors.Is(err, fs.ErrExist) {
		return ErrExists
	}
	if err != nil {
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	s.publish(ctx, TopicCreated, Change{Path: path, Kind: "file", Version: version(nil)})
	return nil
}

func (s *Service) Mkdir(ctx context.Context, path string) error {
	full, err := s.resolve(path, true)
	if err != nil {
		return err
	}
	if err := os.Mkdir(full, 0755); errors.Is(err, fs.ErrExist) {
		return ErrExists
	} else if err != nil {
		return err
	}
	s.publish(ctx, TopicCreated, Change{Path: path, Kind: "directory"})
	return nil
}

// Rename moves a file or directory; the destination must not exist.
func (s *Service) Rename(ctx context.Context, from, to string) error {
	s.tree.Lock()
	defer s.tree.Unlock()
	src, err := s.resolve(from, false)
	if err != nil {
		return err
	}
	dst, err := s.resolve(to, true)
	if err != nil {
		return err
	}
	if _, err := os.Lstat(dst); err == nil {
		return ErrExists
	}
	if strings.HasPrefix(dst, src+string(filepath.Separator)) {
		return ErrInvalidPath
	}
	if err := os.Rename(src, dst); err != nil {
		return err
	}
	s.publish(ctx, TopicRenamed, Change{Path: to, OldPath: from})
	return nil
}

// Delete removes a file or a directory tree.
func (s *Service) Delete(ctx context.Context, path string) error {
	s.tree.Lock()
	defer s.tree.Unlock()
	full, err := s.resolve(path, false)
	if err != nil {
		return err
	}
	if err := os.RemoveAll(full); err != nil {
		return err
	}
	s.publish(ctx, TopicDeleted, Change{Path: path})
	return nil
}

func (s *Service) Save(ctx context.Context, path, content, expectedVersion string) (Document, error) {
	if len(content) > MaxFileSize {
		return Document{}, ErrTooLarge
	}
	if !utf8.ValidString(content) {
		return Document{}, ErrBinary
	}
	defer s.lockPath(path)()
	full, err := s.resolve(path, false)
	if err != nil {
		return Document{}, err
	}
	current, info, err := readContents(full)
	if err != nil {
		return Document{}, err
	}
	currentVersion := version(current)
	if bytes.Equal(current, []byte(content)) {
		return Document{Path: path, Content: content, Version: currentVersion}, nil
	}
	if currentVersion != expectedVersion {
		return Document{}, ErrConflict
	}
	if err := ctx.Err(); err != nil {
		return Document{}, err
	}
	tmp, err := os.CreateTemp(filepath.Dir(full), tempPrefix+"*")
	if err != nil {
		return Document{}, err
	}
	defer os.Remove(tmp.Name())
	if err := tmp.Chmod(info.Mode().Perm()); err != nil {
		tmp.Close()
		return Document{}, err
	}
	if _, err := tmp.WriteString(content); err != nil {
		tmp.Close()
		return Document{}, err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return Document{}, err
	}
	if err := tmp.Close(); err != nil {
		return Document{}, err
	}
	if err := os.Rename(tmp.Name(), full); err != nil {
		return Document{}, err
	}
	doc := Document{Path: path, Content: content, Version: version([]byte(content))}
	s.publish(ctx, TopicSaved, Change{Path: path, Version: doc.Version})
	return doc, nil
}

func (s *Service) publish(ctx context.Context, topic string, change Change) {
	s.search.invalidate(change.Path)
	if change.OldPath != "" {
		s.search.invalidate(change.OldPath)
	}
	if s.bus != nil {
		_ = s.bus.Publish(ctx, events.Event{Topic: topic, Data: change, Origin: events.OriginFrom(ctx)})
	}
}

func join(dir, name string) string {
	if dir == "" {
		return name
	}
	return dir + "/" + name
}

func version(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
