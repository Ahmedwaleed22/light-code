package files

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestSearchFreshness(t *testing.T) {
	root := t.TempDir()
	svc, err := New(root, nil)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	write := func(path, text string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(root, path), []byte(text), 0600); err != nil {
			t.Fatal(err)
		}
	}
	check := func(query, path string) {
		t.Helper()
		matches, _, err := svc.Search(ctx, query, 10)
		if err != nil {
			t.Fatal(err)
		}
		if path == "" {
			if len(matches) != 0 {
				t.Fatalf("%q: unexpected matches %+v", query, matches)
			}
		} else if len(matches) != 1 || matches[0].Path != path {
			t.Fatalf("%q: matches %+v, want %q", query, matches, path)
		}
	}
	write("a.txt", "alpha")
	check("alpha", "a.txt")
	write("a.txt", "bravo") // An external in-place edit with the same length.
	later := time.Now().Add(time.Second)
	if err := os.Chtimes(filepath.Join(root, "a.txt"), later, later); err != nil {
		t.Fatal(err)
	}
	check("alpha", "")
	check("bravo", "a.txt")
	write("replacement", "delta")
	if err := os.Chtimes(filepath.Join(root, "replacement"), later, later); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(filepath.Join(root, "replacement"), filepath.Join(root, "a.txt")); err != nil {
		t.Fatal(err)
	}
	check("bravo", "") // Atomic replacement preserving size and mtime, but changing inode.
	check("delta", "a.txt")
	doc, err := svc.Read("a.txt")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Save(ctx, "a.txt", "gamma", doc.Version); err != nil {
		t.Fatal(err)
	}
	check("delta", "")
	check("gamma", "a.txt")
	if err := svc.Mkdir(ctx, "src"); err != nil {
		t.Fatal(err)
	}
	if err := svc.Rename(ctx, "a.txt", "src/a.txt"); err != nil {
		t.Fatal(err)
	}
	check("gamma", "src/a.txt")
	if err := svc.Rename(ctx, "src", "lib"); err != nil {
		t.Fatal(err)
	}
	check("gamma", "lib/a.txt")
	if err := svc.Delete(ctx, "lib"); err != nil {
		t.Fatal(err)
	}
	check("gamma", "")
}

func TestSearchTextLimits(t *testing.T) {
	root := t.TempDir()
	svc, err := New(root, nil)
	if err != nil {
		t.Fatal(err)
	}
	for path, content := range map[string]string{
		"unicode.txt":   "İSTANBUL\r\nnext İSTANBUL\n",
		"binary.txt":    "ordinary first line\n\x00İSTANBUL",
		"invalid.txt":   "ordinary first line\n\xffİSTANBUL",
		"long.txt":      strings.Repeat("x", MaxFileSize-6) + "needle",
		"oversized.txt": strings.Repeat("x", MaxFileSize) + "needle",
	} {
		if err := os.WriteFile(filepath.Join(root, path), []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
	}
	for i := 0; i < 2; i++ { // Cold and cached results must agree.
		matches, truncated, err := svc.Search(context.Background(), "istanbul", 10)
		if err != nil || truncated || len(matches) != 2 || matches[1].Line != 2 || matches[1].Text != "next İSTANBUL" {
			t.Fatalf("Unicode matches = %+v, %v, %v", matches, truncated, err)
		}
		matches, truncated, err = svc.Search(context.Background(), "istanbul", 1)
		if err != nil || !truncated || len(matches) != 1 {
			t.Fatalf("limit = %+v, %v, %v", matches, truncated, err)
		}
	}
	matches, _, err := svc.Search(context.Background(), "needle", 10)
	if err != nil || len(matches) != 1 || matches[0].Path != "long.txt" || len(matches[0].Text) > 240 {
		t.Fatalf("long line = %+v, %v", matches, err)
	}
}

func TestSearchCacheBounded(t *testing.T) {
	root := t.TempDir()
	svc, err := New(root, nil)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 200; i++ {
		if err := os.WriteFile(filepath.Join(root, fmt.Sprintf("%d.txt", i)), []byte(strings.Repeat("cache data\n", 2000)), 0600); err != nil {
			t.Fatal(err)
		}
	}
	for i := 0; i < 2; i++ {
		if _, _, err := svc.Search(context.Background(), "absent", 10); err != nil {
			t.Fatal(err)
		}
		if svc.search.bytes > searchCacheBytes || len(svc.search.entries) >= 200 {
			t.Fatalf("cache grew without eviction: %d bytes, %d files", svc.search.bytes, len(svc.search.entries))
		}
	}
}

func TestSearchCanceledWhileWaiting(t *testing.T) {
	svc, err := New(t.TempDir(), nil)
	if err != nil {
		t.Fatal(err)
	}
	svc.searchSlot <- struct{}{}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { _, _, err := svc.Search(ctx, "query", 10); done <- err }()
	cancel()
	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) {
			t.Fatal(err)
		}
	case <-time.After(time.Second):
		t.Fatal("search did not cancel while waiting")
	}
	<-svc.searchSlot
}
