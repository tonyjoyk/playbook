use std::collections::HashMap;
use visioncortex::color_clusters::{Cluster, ClusterIndex, ClustersView};

const ZERO: ClusterIndex = ClusterIndex(0);

/// Root cluster in the first-pass depth tree (0 = background / do not merge).
pub fn gestalt_root(view: &ClustersView, idx: ClusterIndex, img_area: usize) -> u32 {
    let cluster = view.get_cluster(idx);
    if is_background_cluster(cluster, img_area) {
        return 0;
    }

    let mut current = idx;
    for _ in 0..10_000 {
        let merged = view.get_cluster(current).merged_into;
        if merged == ZERO || merged == current {
            break;
        }
        current = merged;
    }

    let root = view.get_cluster(current);
    if is_background_cluster(root, img_area) {
        0
    } else {
        current.0
    }
}

fn is_background_cluster(cluster: &Cluster, img_area: usize) -> bool {
    cluster.depth == 0 && cluster.area() > img_area / 3
}

/// Per-pixel gestalt ids from the first hierarchical pass (before cutout re-cluster).
pub fn build_pixel_gestalt(view: &ClustersView, width: usize, height: usize) -> Vec<u32> {
    let img_area = width * height;
    view.cluster_indices
        .iter()
        .map(|&ci| gestalt_root(view, ci, img_area))
        .collect()
}

/// Dominant gestalt id for a cutout cluster via pixel voting on the first-pass map.
pub fn cluster_gestalt_from_pixels(cluster: &Cluster, pixel_gestalt: &[u32]) -> u32 {
    let mut counts: HashMap<u32, usize> = HashMap::new();
    for &pi in cluster.iter() {
        let idx = pi as usize;
        if idx < pixel_gestalt.len() {
            *counts.entry(pixel_gestalt[idx]).or_default() += 1;
        }
    }
    counts
        .into_iter()
        .filter(|(g, _)| *g != 0)
        .max_by_key(|(_, c)| *c)
        .map(|(g, _)| g)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    #[test]
    fn gestalt_module_compiles() {
        assert_eq!(0u32, 0);
    }
}
