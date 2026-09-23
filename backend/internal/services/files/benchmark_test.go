package files

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// A query with no matches measures the full workspace rather than the result limit.
func BenchmarkSearchWorkspace(b *testing.B) {
	root := b.TempDir()
	for i := 0; i < 1000; i++ {
		body := strings.Repeat("const greeting = 'Hello, world!';\n", 32)
		if err := os.WriteFile(filepath.Join(root, fmt.Sprintf("file-%04d.ts", i)), []byte(body), 0600); err != nil {
			b.Fatal(err)
		}
	}
	svc, err := New(root, nil)
	if err != nil {
		b.Fatal(err)
	}
	ctx := context.Background()
	if _, _, err := svc.Search(ctx, "absent", 500); err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, _, err := svc.Search(ctx, "absent", 500); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkSave(b *testing.B) {
	for _, size := range []int{20 << 10, 1 << 20} {
		b.Run(fmt.Sprintf("bytes=%d", size), func(b *testing.B) {
			svc, err := New(b.TempDir(), nil)
			if err != nil {
				b.Fatal(err)
			}
			ctx := context.Background()
			if err := svc.Create(ctx, "file.txt"); err != nil {
				b.Fatal(err)
			}
			doc, err := svc.Read("file.txt")
			if err != nil {
				b.Fatal(err)
			}
			content := strings.Repeat("x", size)
			b.ReportAllocs()
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				doc, err = svc.Save(ctx, "file.txt", fmt.Sprintf("%d\n%s", i, content), doc.Version)
				if err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}
