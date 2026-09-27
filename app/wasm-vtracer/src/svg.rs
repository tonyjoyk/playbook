use std::fmt;
use visioncortex::color_clusters::ClusterIndex;
use visioncortex::{Color, CompoundPath, PointF64};

pub struct SvgFile {
    pub paths: Vec<SvgPath>,
    pub width: usize,
    pub height: usize,
    pub path_precision: Option<u32>,
}

pub struct SvgPath {
    pub path: CompoundPath,
    pub color: Color,
}

pub struct TracedCluster {
    pub cluster_index: ClusterIndex,
    pub path: CompoundPath,
    pub color: Color,
    pub pixel_area: usize,
    /// First-pass depth-tree root (0 = background).
    pub gestalt_id: u32,
}

impl SvgFile {
    pub fn new(width: usize, height: usize, path_precision: Option<u32>) -> Self {
        Self {
            paths: vec![],
            width,
            height,
            path_precision,
        }
    }

    pub fn add_path(&mut self, path: CompoundPath, color: Color) {
        self.paths.push(SvgPath { path, color });
    }
}

impl fmt::Display for SvgFile {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        writeln!(f, r#"<?xml version="1.0" encoding="UTF-8"?>"#)?;
        writeln!(
            f,
            r#"<!-- Generator: visioncortex VTracer {} -->"#,
            env!("CARGO_PKG_VERSION")
        )?;
        writeln!(
            f,
            r#"<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="{}" height="{}">"#,
            self.width, self.height
        )?;
        for path in &self.paths {
            path.fmt_with_precision(f, self.path_precision)?;
        }
        writeln!(f, "</svg>")
    }
}

impl SvgPath {
    pub fn fmt_with_precision(
        &self,
        f: &mut fmt::Formatter,
        precision: Option<u32>,
    ) -> fmt::Result {
        let (string, offset) = self
            .path
            .to_svg_string(true, PointF64::default(), precision);
        writeln!(
            f,
            r#"<path d="{}" fill="{}" transform="translate({},{})"/>"#,
            string,
            self.color.to_hex_string(),
            offset.x,
            offset.y
        )
    }
}
