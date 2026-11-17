package storage

import (
	"reflect"
	"testing"
)

func TestBuildS3DirTree(t *testing.T) {
	t.Run("SingleBucketMissingParentAndLexicographicalSubdir", func(t *testing.T) {
		counts := map[string]int{".": 0}
		order := []string{"."}

		keys := []string{
			"alpha/img.jpg",
			// "beta/a/..." sorts before "beta/z.jpg" in S3 ListObjects
			"beta/a/img.jpg",
			"beta/z.jpg",
			// Parent "gamma" and "gamma/sub1" have no direct images
			"gamma/sub1/sub2/img.png",
			// Sibling prefix collision: "dir-backup" sorts before "dir/sub" in ASCII ('-' < '/')
			"dir-backup/img.jpg",
			"dir/img.jpg",
			"dir/sub/img.jpg",
		}

		for _, k := range keys {
			addS3ObjectToDirCounts("mybucket", false, k, counts, &order)
		}
		sortDirPaths(order)

		wantOrder := []string{
			".",
			"alpha",
			"beta",
			"beta/a",
			"dir",
			"dir/sub",
			"dir-backup",
			"gamma",
			"gamma/sub1",
			"gamma/sub1/sub2",
		}
		if !reflect.DeepEqual(order, wantOrder) {
			t.Fatalf("order mismatch:\ngot:  %v\nwant: %v", order, wantOrder)
		}

		wantCounts := map[string]int{
			".":               0,
			"alpha":           1,
			"beta":            1,
			"beta/a":          1,
			"dir":             1,
			"dir/sub":         1,
			"dir-backup":      1,
			"gamma":           0,
			"gamma/sub1":      0,
			"gamma/sub1/sub2": 1,
		}
		if !reflect.DeepEqual(counts, wantCounts) {
			t.Fatalf("counts mismatch:\ngot:  %v\nwant: %v", counts, wantCounts)
		}
	})

	t.Run("MultiBucketTree", func(t *testing.T) {
		counts := map[string]int{"b1": 0}
		order := []string{"b1"}

		keys := []string{
			"root.jpg",
			"dir-2/a.jpg",
			"dir/sub/b.jpg",
		}
		for _, k := range keys {
			addS3ObjectToDirCounts("b1", true, k, counts, &order)
		}
		sortDirPaths(order)

		wantOrder := []string{
			"b1",
			"b1/dir",
			"b1/dir/sub",
			"b1/dir-2",
		}
		if !reflect.DeepEqual(order, wantOrder) {
			t.Fatalf("order mismatch:\ngot:  %v\nwant: %v", order, wantOrder)
		}
		if counts["b1"] != 1 || counts["b1/dir"] != 0 || counts["b1/dir/sub"] != 1 || counts["b1/dir-2"] != 1 {
			t.Fatalf("unexpected counts: %v", counts)
		}
	})
}
