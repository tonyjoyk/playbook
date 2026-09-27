//! Distance-transform watershed split for touching same-colour characters.
//!
//! Not wired into the main trace pipeline unless Gate B fails on under-split.
//! Conservative peak distance avoids splitting multi-part characters (e.g. sauropod neck).

/// Binary mask indexed row-major (width × height).
pub type Mask = Vec<bool>;

/// Count connected foreground components in a mask (4-neighbour).
pub fn count_components(mask: &Mask, width: usize, height: usize) -> usize {
    let mut visited = vec![false; mask.len()];
    let mut count = 0usize;
    for y in 0..height {
        for x in 0..width {
            let i = y * width + x;
            if !mask[i] || visited[i] {
                continue;
            }
            count += 1;
            flood_fill(mask, &mut visited, width, height, x, y);
        }
    }
    count
}

fn flood_fill(
    mask: &Mask,
    visited: &mut [bool],
    width: usize,
    height: usize,
    sx: usize,
    sy: usize,
) {
    let mut stack = vec![(sx, sy)];
    while let Some((x, y)) = stack.pop() {
        let i = y * width + x;
        if x >= width || y >= height || visited[i] || !mask[i] {
            continue;
        }
        visited[i] = true;
        if x > 0 {
            stack.push((x - 1, y));
        }
        if x + 1 < width {
            stack.push((x + 1, y));
        }
        if y > 0 {
            stack.push((x, y - 1));
        }
        if y + 1 < height {
            stack.push((x, y + 1));
        }
    }
}

/// Squared Euclidean distance transform (foreground pixels only).
pub fn distance_transform(mask: &Mask, width: usize, height: usize) -> Vec<f64> {
    let inf = f64::INFINITY;
    let mut dist = vec![inf; mask.len()];

    for y in 0..height {
        for x in 0..width {
            let i = y * width + x;
            if !mask[i] {
                dist[i] = 0.0;
                continue;
            }
            let boundary = is_boundary(mask, width, height, x, y);
            dist[i] = if boundary { 1.0 } else { inf };
        }
    }

    // Two-pass chamfer propagation (3-4 metric).
    for y in 0..height {
        for x in 0..width {
            let i = y * width + x;
            if !mask[i] {
                continue;
            }
            let mut best = dist[i];
            if x > 0 {
                best = best.max(dist[i - 1] + 1.0);
            }
            if y > 0 {
                best = best.max(dist[i - width] + 1.0);
            }
            if x > 0 && y > 0 {
                best = best.max(dist[i - width - 1] + 1.414);
            }
            if x + 1 < width && y > 0 {
                best = best.max(dist[i - width + 1] + 1.414);
            }
            dist[i] = best;
        }
    }
    for y in (0..height).rev() {
        for x in (0..width).rev() {
            let i = y * width + x;
            if !mask[i] {
                continue;
            }
            let mut best = dist[i];
            if x + 1 < width {
                best = best.max(dist[i + 1] + 1.0);
            }
            if y + 1 < height {
                best = best.max(dist[i + width] + 1.0);
            }
            if x + 1 < width && y + 1 < height {
                best = best.max(dist[i + width + 1] + 1.414);
            }
            if x > 0 && y + 1 < height {
                best = best.max(dist[i + width - 1] + 1.414);
            }
            dist[i] = best;
        }
    }
    dist
}

fn is_boundary(mask: &Mask, width: usize, height: usize, x: usize, y: usize) -> bool {
    if x == 0 || y == 0 || x + 1 == width || y + 1 == height {
        return true;
    }
    for (dx, dy) in [(-1i32, 0), (1, 0), (0, -1), (0, 1)] {
        let nx = x as i32 + dx;
        let ny = y as i32 + dy;
        let ni = ny as usize * width + nx as usize;
        if !mask[ni] {
            return true;
        }
    }
    false
}

/// Local maxima in distance map above `min_peak` (conservative split seeds).
pub fn local_maxima(dist: &[f64], mask: &Mask, width: usize, height: usize, min_peak: f64) -> Vec<usize> {
    let mut peaks = Vec::new();
    for y in 1..height - 1 {
        for x in 1..width - 1 {
            let i = y * width + x;
            if !mask[i] || dist[i] < min_peak {
                continue;
            }
            let d = dist[i];
            let mut is_max = true;
            for (dx, dy) in [(-1i32, 0), (1, 0), (0, -1), (0, 1)] {
                let nx = (x as i32 + dx) as usize;
                let ny = (y as i32 + dy) as usize;
                let ni = ny * width + nx;
                if dist[ni] > d {
                    is_max = false;
                    break;
                }
            }
            if is_max {
                peaks.push(i);
            }
        }
    }
    peaks
}

/// Label basins by nearest peak (Voronoi / watershed seeds). Returns label per pixel (0 = background).
pub fn watershed_labels(
    mask: &Mask,
    width: usize,
    height: usize,
    peaks: &[usize],
) -> Vec<u32> {
    let mut labels = vec![0u32; mask.len()];
    if peaks.is_empty() {
        return labels;
    }
    let mut queue: std::collections::VecDeque<(usize, u32)> = std::collections::VecDeque::new();
    for (label, &pi) in peaks.iter().enumerate() {
        let lab = (label + 1) as u32;
        labels[pi] = lab;
        queue.push_back((pi, lab));
    }
    while let Some((i, lab)) = queue.pop_front() {
        let x = i % width;
        let y = i / width;
        for (dx, dy) in [(-1i32, 0), (1, 0), (0, -1), (0, 1)] {
            let nx = x as i32 + dx;
            let ny = y as i32 + dy;
            if nx < 0 || ny < 0 || nx as usize >= width || ny as usize >= height {
                continue;
            }
            let ni = ny as usize * width + nx as usize;
            if !mask[ni] || labels[ni] != 0 {
                continue;
            }
            labels[ni] = lab;
            queue.push_back((ni, lab));
        }
    }
    labels
}

#[cfg(test)]
mod tests {
    use super::*;

    fn circle_mask(cx: i32, cy: i32, r: i32, width: usize, height: usize) -> Mask {
        let mut mask = vec![false; width * height];
        for y in 0..height as i32 {
            for x in 0..width as i32 {
                if (x - cx).pow(2) + (y - cy).pow(2) <= r * r {
                    mask[y as usize * width + x as usize] = true;
                }
            }
        }
        mask
    }

    #[test]
    fn two_touching_circles_have_two_peaks() {
        let width = 60;
        let height = 40;
        let mut mask = circle_mask(18, 20, 12, width, height);
        let right = circle_mask(42, 20, 12, width, height);
        for (i, on) in right.iter().enumerate() {
            if *on {
                mask[i] = true;
            }
        }
        assert_eq!(count_components(&mask, width, height), 1);
        let dist = distance_transform(&mask, width, height);
        let peaks = local_maxima(&dist, &mask, width, height, 4.0);
        assert!(
            peaks.len() >= 2,
            "expected >= 2 peaks for two touching blobs, got {}",
            peaks.len()
        );
        let labels = watershed_labels(&mask, width, height, &peaks);
        let basin_ids: std::collections::HashSet<u32> = labels.iter().copied().filter(|&l| l > 0).collect();
        assert!(basin_ids.len() >= 2);
    }
}
