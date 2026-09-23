package files

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestCreateReadSaveAndConflict(t *testing.T) {
	root := t.TempDir()
	svc, err := New(root, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.Create("note.txt"); err != nil {
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
		if err := svc.Create(path); !errors.Is(err, ErrInvalidPath) {
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
