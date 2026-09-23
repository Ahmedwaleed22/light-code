package files

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
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
)

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
	mu   sync.Mutex
}

func New(root string, bus events.Bus) (*Service, error) {
	absolute, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(absolute, 0755); err != nil {
		return nil, err
	}
	return &Service{root: absolute, bus: bus}, nil
}

// resolve accepts slash-separated relative paths and rejects symlinks in every component.
func (s *Service) resolve(path string, allowMissing bool) (string, error) {
	if path == "" || strings.Contains(path, "\\") || strings.ContainsRune(path, 0) || strings.HasPrefix(path, "/") {
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

func (s *Service) List() ([]Entry, error) {
	entries := []Entry{}
	err := filepath.WalkDir(s.root, func(path string, item fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if path == s.root {
			return nil
		}
		if item.Type()&os.ModeSymlink != 0 {
			return nil
		}
		if item.IsDir() && (item.Name() == ".git" || item.Name() == "node_modules") {
			return filepath.SkipDir
		}
		rel, err := filepath.Rel(s.root, path)
		if err != nil {
			return err
		}
		kind := "file"
		if item.IsDir() {
			kind = "directory"
		}
		entries = append(entries, Entry{Path: filepath.ToSlash(rel), Name: item.Name(), Kind: kind})
		return nil
	})
	sort.Slice(entries, func(i, j int) bool { return entries[i].Path < entries[j].Path })
	return entries, err
}

func (s *Service) Read(path string) (Document, error) {
	full, err := s.resolve(path, false)
	if err != nil {
		return Document{}, err
	}
	file, err := os.Open(full)
	if errors.Is(err, fs.ErrNotExist) {
		return Document{}, ErrNotFound
	}
	if err != nil {
		return Document{}, err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return Document{}, err
	}
	if !info.Mode().IsRegular() {
		return Document{}, ErrInvalidPath
	}
	if info.Size() > MaxFileSize {
		return Document{}, ErrTooLarge
	}
	data, err := io.ReadAll(io.LimitReader(file, MaxFileSize+1))
	if err != nil {
		return Document{}, err
	}
	if len(data) > MaxFileSize {
		return Document{}, ErrTooLarge
	}
	if !utf8.Valid(data) {
		return Document{}, ErrBinary
	}
	return Document{Path: path, Content: string(data), Version: version(data)}, nil
}

func (s *Service) Create(path string) error {
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
	return file.Close()
}

func (s *Service) Save(ctx context.Context, path, content, expectedVersion string) (Document, error) {
	if len(content) > MaxFileSize {
		return Document{}, ErrTooLarge
	}
	if !utf8.ValidString(content) {
		return Document{}, ErrBinary
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	full, err := s.resolve(path, false)
	if err != nil {
		return Document{}, err
	}
	current, err := s.Read(path)
	if err != nil {
		return Document{}, err
	}
	if current.Version != expectedVersion {
		return Document{}, ErrConflict
	}
	info, err := os.Stat(full)
	if err != nil {
		return Document{}, err
	}
	tmp, err := os.CreateTemp(filepath.Dir(full), ".editor-*")
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
	if s.bus != nil {
		_ = s.bus.Publish(ctx, events.Event{Topic: "file.saved", Data: path})
	}
	return doc, nil
}

func version(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
