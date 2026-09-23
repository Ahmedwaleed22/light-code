package files

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"testing"
)

func TestCreateReadSaveAndConflict(t *testing.T) {
	root := t.TempDir()
	svc, err := New(root, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.Create(context.Background(), "note.txt"); err != nil {
		t.Fatal(err)
	}
	initial, err := svc.Read("note.txt")
	if err != nil {
		t.Fatal(err)
	}
	saved, err := svc.Save(context.Background(), "note.txt", "hello", initial.Version)
	if err != nil {
		t.Fatal(err)
	}
	if saved.Content != "hello" || saved.Version == initial.Version {
		t.Fatalf("unexpected saved document: %+v", saved)
	}
	if _, err := svc.Save(context.Background(), "note.txt", "stale", initial.Version); !errors.Is(err, ErrConflict) {
		t.Fatalf("want conflict, got %v", err)
	}
	current, err := svc.Read("note.txt")
	if err != nil || current.Content != "hello" {
		t.Fatalf("unexpected current document: %+v, %v", current, err)
	}
}

func TestRejectsTraversalAndSymlink(t *testing.T) {
	root := t.TempDir()
	svc, err := New(root, nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"../outside", "/etc/passwd", "a/../b"} {
		if err := svc.Create(context.Background(), path); !errors.Is(err, ErrInvalidPath) {
			t.Errorf("Create(%q) = %v", path, err)
		}
	}
	outside := filepath.Join(t.TempDir(), "secret.txt")
	if err := os.WriteFile(outside, []byte("secret"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(root, "link")); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Read("link"); !errors.Is(err, ErrInvalidPath) {
		t.Fatalf("Read symlink = %v", err)
	}
}

func TestRetriedSaveIsIdempotent(t *testing.T) {
	svc, _ := New(t.TempDir(), nil)
	ctx := context.Background()
	_ = svc.Create(ctx, "a.txt")
	initial, _ := svc.Read("a.txt")
	if _, err := svc.Save(ctx, "a.txt", "x", initial.Version); err != nil {
		t.Fatal(err)
	}
	// The response was lost and the client retries with the old version.
	doc, err := svc.Save(ctx, "a.txt", "x", initial.Version)
	if err != nil || doc.Content != "x" {
		t.Fatalf("retry = %+v, %v", doc, err)
	}
}

func TestTreeOperationsAndSearch(t *testing.T) {
	svc, _ := New(t.TempDir(), nil)
	ctx := context.Background()
	if err := svc.Mkdir(ctx, "src"); err != nil {
		t.Fatal(err)
	}
	_ = svc.Create(ctx, "src/main.go")
	_ = svc.Create(ctx, "b.txt")
	doc, _ := svc.Read("src/main.go")
	if _, err := svc.Save(ctx, "src/main.go", "package main\nfunc Hello() {}\n", doc.Version); err != nil {
		t.Fatal(err)
	}
	root, err := svc.ListDir("")
	if err != nil || len(root) != 2 || root[0].Path != "src" || root[0].Kind != "directory" || root[1].Path != "b.txt" {
		t.Fatalf("ListDir = %+v, %v", root, err)
	}
	matches, _, err := svc.Search(ctx, "hello", 10)
	if err != nil || len(matches) != 1 || matches[0].Path != "src/main.go" || matches[0].Line != 2 {
		t.Fatalf("Search = %+v, %v", matches, err)
	}
	if err := svc.Rename(ctx, "src", "src/inner"); !errors.Is(err, ErrInvalidPath) {
		t.Fatalf("rename into self = %v", err)
	}
	if err := svc.Rename(ctx, "b.txt", "src/main.go"); !errors.Is(err, ErrExists) {
		t.Fatalf("rename onto existing = %v", err)
	}
	if err := svc.Rename(ctx, "src", "lib"); err != nil {
		t.Fatal(err)
	}
	paths, _, _ := svc.Index(ctx, 100)
	if len(paths) != 2 || paths[1] != "lib/main.go" {
		t.Fatalf("Index = %v", paths)
	}
	if err := svc.Delete(ctx, "lib"); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.ListDir("lib"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("ListDir deleted = %v", err)
	}
}

func TestConcurrentSaves(t *testing.T) {
	svc, _ := New(t.TempDir(), nil)
	ctx := context.Background()
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		path := "f" + strconv.Itoa(i) + ".txt"
		_ = svc.Create(ctx, path)
		wg.Add(1)
		go func() {
			defer wg.Done()
			doc, _ := svc.Read(path)
			for j := 0; j < 20; j++ {
				next, err := svc.Save(ctx, path, strconv.Itoa(j), doc.Version)
				if err != nil {
					t.Error(err)
					return
				}
				doc = next
			}
		}()
	}
	// Two writers racing on one file: exactly one save per version may win.
	_ = svc.Create(ctx, "shared.txt")
	base, _ := svc.Read("shared.txt")
	wins := make(chan error, 2)
	for _, content := range []string{"a", "b"} {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := svc.Save(ctx, "shared.txt", content, base.Version)
			wins <- err
		}()
	}
	wg.Wait()
	close(wins)
	conflicts := 0
	for err := range wins {
		if errors.Is(err, ErrConflict) {
			conflicts++
		}
	}
	if conflicts != 1 {
		t.Fatalf("want exactly one conflict, got %d", conflicts)
	}
}

func TestUnchangedSaveDoesNotRewrite(t *testing.T) {
	root := t.TempDir()
	svc, err := New(root, nil)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	if err := svc.Create(ctx, "a.txt"); err != nil {
		t.Fatal(err)
	}
	doc, err := svc.Read("a.txt")
	if err != nil {
		t.Fatal(err)
	}
	before, err := os.Stat(filepath.Join(root, "a.txt"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Save(ctx, "a.txt", "", doc.Version); err != nil {
		t.Fatal(err)
	}
	after, err := os.Stat(filepath.Join(root, "a.txt"))
	if err != nil {
		t.Fatal(err)
	}
	if !os.SameFile(before, after) || before.ModTime() != after.ModTime() {
		t.Fatal("unchanged save rewrote the file")
	}
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	if _, err := svc.Save(canceled, "a.txt", "changed", doc.Version); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled save = %v", err)
	}
	current, err := svc.Read("a.txt")
	if err != nil || current.Version != doc.Version {
		t.Fatalf("canceled save modified file: %+v, %v", current, err)
	}
}
