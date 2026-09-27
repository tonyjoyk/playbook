use crate::svg::{SvgPath, TracedCluster};
use std::collections::HashMap;
use std::fmt;
use visioncortex::color_clusters::{ClusterIndex, ClustersView};

pub struct SceneObject {
    pub id: String,
    pub paths: Vec<SvgPath>,
}

pub struct SceneSvg {
    pub objects: Vec<SceneObject>,
    pub width: usize,
    pub height: usize,
    pub path_precision: Option<u32>,
}

fn cluster_id(index: ClusterIndex) -> u32 {
    index.0
}

fn same_fill(a: &TracedCluster, b: &TracedCluster) -> bool {
    a.color.to_hex_string() == b.color.to_hex_string()
}

fn is_background_object(c: &TracedCluster, width: usize, height: usize) -> bool {
    let img_area = width * height;
    c.gestalt_id == 0 || c.pixel_area > img_area / 3
}

/// Small detail on a foreground shape (belly patch, eye, etc.).
fn cross_fill_gestalt(a: &TracedCluster, b: &TracedCluster, width: usize, height: usize) -> bool {
    if same_fill(a, b) {
        return false;
    }
    let img_area = width * height;
    let area_a = a.pixel_area;
    let area_b = b.pixel_area;
    let (small, large) = if area_a < area_b {
        (area_a, area_b)
    } else {
        (area_b, area_a)
    };
    if large > img_area / 3 {
        return false;
    }
    small * 3 < large && small < img_area / 20
}

/// Union touching clusters when they share a depth-tree gestalt or cross-fill gestalt applies.
fn should_union(a: &TracedCluster, b: &TracedCluster, width: usize, height: usize) -> bool {
    if is_background_object(a, width, height) || is_background_object(b, width, height) {
        return false;
    }
    if a.gestalt_id != 0 && a.gestalt_id == b.gestalt_id {
        return true;
    }
    cross_fill_gestalt(a, b, width, height)
}

struct UnionFind {
    parent: HashMap<u32, u32>,
}

impl UnionFind {
    fn new(ids: &[u32]) -> Self {
        let parent = ids.iter().copied().map(|id| (id, id)).collect();
        Self { parent }
    }

    fn find(&mut self, x: u32) -> u32 {
        let p = *self.parent.get(&x).unwrap_or(&x);
        if p != x {
            let root = self.find(p);
            self.parent.insert(x, root);
            root
        } else {
            x
        }
    }

    fn union(&mut self, a: u32, b: u32) {
        let ra = self.find(a);
        let rb = self.find(b);
        if ra == rb {
            return;
        }
        let (root, child) = if ra < rb { (ra, rb) } else { (rb, ra) };
        self.parent.insert(child, root);
    }
}

/// Group cutout clusters: speckle redirect, then union-find on touching active clusters.
pub fn build_scene_from_clusters(
    view: &ClustersView,
    traced: Vec<TracedCluster>,
    min_area: usize,
    width: usize,
    height: usize,
    path_precision: Option<u32>,
) -> SceneSvg {
    if traced.is_empty() {
        return SceneSvg {
            objects: vec![],
            width,
            height,
            path_precision,
        };
    }

    let by_id: HashMap<u32, usize> = traced
        .iter()
        .enumerate()
        .map(|(i, t)| (cluster_id(t.cluster_index), i))
        .collect();

    let mut speckle_attach: HashMap<u32, Vec<usize>> = HashMap::new();
    let mut active_ids: Vec<u32> = Vec::new();

    for (i, t) in traced.iter().enumerate() {
        let id = cluster_id(t.cluster_index);
        if t.pixel_area < min_area {
            let cluster = view.get_cluster(t.cluster_index);
            let best = cluster
                .neighbours(view)
                .into_iter()
                .filter_map(|n| {
                    let nid = cluster_id(n);
                    by_id.get(&nid).map(|&idx| (nid, traced[idx].pixel_area))
                })
                .filter(|(_, area)| *area >= min_area)
                .max_by(|a, b| {
                    a.1.cmp(&b.1)
                        .then_with(|| cluster_id(ClusterIndex(a.0)).cmp(&cluster_id(ClusterIndex(b.0))))
                });
            if let Some((target_id, _)) = best {
                speckle_attach.entry(target_id).or_default().push(i);
            }
        } else {
            active_ids.push(id);
        }
    }

    active_ids.sort_unstable();

    let mut uf = UnionFind::new(&active_ids);
    for &id in &active_ids {
        let idx = by_id[&id];
        let cluster_a = &traced[idx];
        let cluster = view.get_cluster(traced[idx].cluster_index);
        for neighbour in cluster.neighbours(view) {
            let nid = cluster_id(neighbour);
            if active_ids.binary_search(&nid).is_ok() {
                let n_idx = by_id[&nid];
                if should_union(cluster_a, &traced[n_idx], width, height) {
                    uf.union(id, nid);
                }
            }
        }
    }

    let mut components: HashMap<u32, Vec<usize>> = HashMap::new();
    for &id in &active_ids {
        let root = uf.find(id);
        components.entry(root).or_default().push(by_id[&id]);
    }
    for (target_id, speckle_indices) in speckle_attach {
        if let Some(active_indices) = components.get_mut(&uf.find(target_id)) {
            active_indices.extend(speckle_indices);
        }
    }

    let mut component_list: Vec<(usize, u32, Vec<usize>)> = components
        .into_iter()
        .map(|(root, mut indices)| {
            indices.sort_unstable();
            let total_area: usize = indices.iter().map(|&i| traced[i].pixel_area).sum();
            (total_area, root, indices)
        })
        .collect();

    component_list.sort_by(|a, b| {
        b.0.cmp(&a.0).then_with(|| a.1.cmp(&b.1))
    });

    let objects = component_list
        .into_iter()
        .enumerate()
        .map(|(obj_idx, (_, _, indices))| {
            let paths = indices
                .into_iter()
                .map(|i| SvgPath {
                    path: traced[i].path.clone(),
                    color: traced[i].color,
                })
                .collect();
            SceneObject {
                id: format!("obj-{obj_idx}"),
                paths,
            }
        })
        .collect();

    SceneSvg {
        objects,
        width,
        height,
        path_precision,
    }
}

impl fmt::Display for SceneSvg {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        writeln!(f, r#"<?xml version="1.0" encoding="UTF-8"?>"#)?;
        writeln!(
            f,
            r#"<!-- Generator: visioncortex VTracer {} scene -->"#,
            env!("CARGO_PKG_VERSION")
        )?;
        writeln!(
            f,
            r#"<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="{}" height="{}">"#,
            self.width, self.height
        )?;
        for obj in &self.objects {
            writeln!(f, r#"<g data-object-id="{}">"#, obj.id)?;
            for path in &obj.paths {
                path.fmt_with_precision(f, self.path_precision)?;
            }
            writeln!(f, "</g>")?;
        }
        writeln!(f, "</svg>")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn union_find_merges_touching_ids() {
        let mut uf = UnionFind::new(&[1, 2, 3]);
        uf.union(1, 2);
        assert_eq!(uf.find(1), uf.find(2));
        assert_ne!(uf.find(1), uf.find(3));
    }

    #[test]
    fn union_find_separates_disjoint() {
        let mut uf = UnionFind::new(&[1, 2, 3]);
        assert_ne!(uf.find(1), uf.find(2));
        assert_ne!(uf.find(2), uf.find(3));
    }

    #[test]
    fn union_find_deterministic_root() {
        let mut uf = UnionFind::new(&[5, 3]);
        uf.union(5, 3);
        assert_eq!(uf.find(5), 3);
        assert_eq!(uf.find(3), 3);
    }

    #[test]
    fn should_not_union_same_fill_adjacent() {
        use visioncortex::Color;
        let a = TracedCluster {
            cluster_index: ClusterIndex(1),
            path: visioncortex::CompoundPath::new(),
            color: Color::new(10, 20, 30),
            pixel_area: 100,
            gestalt_id: 1,
        };
        let b = TracedCluster {
            cluster_index: ClusterIndex(2),
            path: visioncortex::CompoundPath::new(),
            color: Color::new(10, 20, 30),
            pixel_area: 200,
            gestalt_id: 2,
        };
        assert!(!should_union(&a, &b, 100, 100));
    }

    #[test]
    fn should_union_same_gestalt() {
        use visioncortex::Color;
        let a = TracedCluster {
            cluster_index: ClusterIndex(1),
            path: visioncortex::CompoundPath::new(),
            color: Color::new(10, 20, 30),
            pixel_area: 100,
            gestalt_id: 5,
        };
        let b = TracedCluster {
            cluster_index: ClusterIndex(2),
            path: visioncortex::CompoundPath::new(),
            color: Color::new(200, 100, 90),
            pixel_area: 800,
            gestalt_id: 5,
        };
        assert!(should_union(&a, &b, 100, 100));
    }

    #[test]
    fn should_not_union_foreground_with_background_band() {
        use visioncortex::Color;
        let mesa = TracedCluster {
            cluster_index: ClusterIndex(1),
            path: visioncortex::CompoundPath::new(),
            color: Color::new(200, 100, 90),
            pixel_area: 800,
            gestalt_id: 3,
        };
        let sky = TracedCluster {
            cluster_index: ClusterIndex(2),
            path: visioncortex::CompoundPath::new(),
            color: Color::new(180, 210, 220),
            pixel_area: 5000,
            gestalt_id: 0,
        };
        assert!(!should_union(&mesa, &sky, 100, 100));
    }
}
