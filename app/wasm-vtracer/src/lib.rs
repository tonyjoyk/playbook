mod depth;
mod scene;
mod svg;
mod watershed;

use depth::{build_pixel_gestalt, cluster_gestalt_from_pixels};

use serde::{Deserialize, Serialize};
use scene::build_scene_from_clusters;
use svg::{SvgFile, TracedCluster};
use visioncortex::color_clusters::{Clusters, ClustersView, KeyingAction, Runner, RunnerConfig, HIERARCHICAL_MAX};
use visioncortex::{Color, ColorImage, ColorName, PathSimplifyMode};
use wasm_bindgen::prelude::*;

const KEYING_THRESHOLD: f32 = 0.2;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TraceConfig {
    binary: bool,
    mode: String,
    hierarchical: String,
    corner_threshold: f64,
    length_threshold: f64,
    max_iterations: usize,
    splice_threshold: f64,
    filter_speckle: usize,
    color_precision: i32,
    layer_difference: i32,
    path_precision: u32,
}

struct ConverterConfig {
    hierarchical_cutout: bool,
    filter_speckle_area: usize,
    color_precision_loss: i32,
    layer_difference: i32,
    corner_threshold: f64,
    length_threshold: f64,
    max_iterations: usize,
    splice_threshold: f64,
    path_precision: Option<u32>,
}

fn deg2rad(deg: f64) -> f64 {
    deg / 180.0 * std::f64::consts::PI
}

fn into_converter_config(config: &TraceConfig) -> ConverterConfig {
    ConverterConfig {
        hierarchical_cutout: config.hierarchical == "cutout",
        filter_speckle_area: config.filter_speckle * config.filter_speckle,
        color_precision_loss: 8 - config.color_precision,
        layer_difference: config.layer_difference,
        corner_threshold: deg2rad(config.corner_threshold),
        length_threshold: config.length_threshold,
        max_iterations: config.max_iterations,
        splice_threshold: deg2rad(config.splice_threshold),
        path_precision: Some(config.path_precision),
    }
}

fn path_mode(config: &TraceConfig) -> PathSimplifyMode {
    match config.mode.as_str() {
        "polygon" => PathSimplifyMode::Polygon,
        "pixel" => PathSimplifyMode::None,
        _ => PathSimplifyMode::Spline,
    }
}

#[wasm_bindgen]
pub fn to_svg(pixels: Vec<u8>, width: usize, height: usize, config_js: JsValue) -> Result<String, JsValue> {
    let config: TraceConfig = serde_wasm_bindgen::from_value(config_js)
        .map_err(|e| JsValue::from_str(&format!("config error: {e}")))?;

    let image = ColorImage {
        pixels,
        width,
        height,
    };

    let mode = path_mode(&config);
    let converter = into_converter_config(&config);
    let svg = if config.binary {
        trace_binary(image, &converter, mode)?
    } else {
        trace_color(image, &converter, mode)?
    };

    Ok(svg.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TracePair {
    raw: String,
    scene: String,
    object_count: usize,
}

#[wasm_bindgen]
pub fn trace_pair(
    pixels: Vec<u8>,
    width: usize,
    height: usize,
    raw_config_js: JsValue,
    scene_config_js: JsValue,
) -> Result<JsValue, JsValue> {
    let raw_config: TraceConfig = serde_wasm_bindgen::from_value(raw_config_js)
        .map_err(|e| JsValue::from_str(&format!("raw config error: {e}")))?;
    let scene_config: TraceConfig = serde_wasm_bindgen::from_value(scene_config_js)
        .map_err(|e| JsValue::from_str(&format!("scene config error: {e}")))?;

    let image = ColorImage {
        pixels,
        width,
        height,
    };

    let raw_mode = path_mode(&raw_config);
    let raw_converter = into_converter_config(&raw_config);
    let pixels_copy = image.pixels.clone();
    let raw_svg = if raw_config.binary {
        trace_binary(image, &raw_converter, raw_mode)?
    } else {
        trace_color(image, &raw_converter, raw_mode)?
    };
    let raw = raw_svg.to_string();

    let image2 = ColorImage {
        pixels: pixels_copy,
        width,
        height,
    };
    let scene_mode = path_mode(&scene_config);
    let scene_converter = into_converter_config(&scene_config);
    let scene_built = if scene_config.binary {
        let svg = trace_binary(image2, &scene_converter, scene_mode)?;
        scene::SceneSvg {
            objects: svg
                .paths
                .into_iter()
                .enumerate()
                .map(|(i, p)| scene::SceneObject {
                    id: format!("obj-{i}"),
                    paths: vec![svg::SvgPath {
                        path: p.path,
                        color: p.color,
                    }],
                })
                .collect(),
            width,
            height,
            path_precision: scene_converter.path_precision,
        }
    } else {
        trace_color_scene(image2, &scene_converter, scene_mode)?
    };
    let object_count = scene_built.objects.len();
    let scene = scene_built.to_string();

    serde_wasm_bindgen::to_value(&TracePair {
        raw,
        scene,
        object_count,
    })
    .map_err(|e| JsValue::from_str(&format!("serialize error: {e}")))
}

struct ClusterRunResult {
    clusters: Clusters,
    pixel_gestalt: Option<Vec<u32>>,
}

fn run_color_clusters(mut img: ColorImage, config: &ConverterConfig) -> Result<ClusterRunResult, JsValue> {
    let width = img.width;
    let height = img.height;

    let key_color = if should_key_image(&img) {
        let key_color = find_unused_color_in_image(&img)
            .map_err(|e| JsValue::from_str(&e))?;
        for y in 0..height {
            for x in 0..width {
                if img.get_pixel(x, y).a == 0 {
                    img.set_pixel(x, y, &key_color);
                }
            }
        }
        key_color
    } else {
        Color::default()
    };

    let runner = Runner::new(
        RunnerConfig {
            diagonal: config.layer_difference == 0,
            hierarchical: HIERARCHICAL_MAX,
            batch_size: 25600,
            good_min_area: config.filter_speckle_area,
            good_max_area: width * height,
            is_same_color_a: config.color_precision_loss,
            is_same_color_b: 1,
            deepen_diff: config.layer_difference,
            hollow_neighbours: 1,
            key_color,
            keying_action: if config.hierarchical_cutout {
                KeyingAction::Keep
            } else {
                KeyingAction::Discard
            },
        },
        img,
    );

    let mut clusters = runner.run();
    let pixel_gestalt = if config.hierarchical_cutout {
        let view = clusters.view();
        let gestalt = build_pixel_gestalt(&view, width, height);
        let image = view.to_color_image();
        let runner = Runner::new(
            RunnerConfig {
                diagonal: false,
                hierarchical: 64,
                batch_size: 25600,
                good_min_area: 0,
                good_max_area: image.width * image.height,
                is_same_color_a: 0,
                is_same_color_b: 1,
                deepen_diff: 0,
                hollow_neighbours: 0,
                key_color: Color::default(),
                keying_action: KeyingAction::Discard,
            },
            image,
        );
        clusters = runner.run();
        Some(gestalt)
    } else {
        None
    };

    Ok(ClusterRunResult {
        clusters,
        pixel_gestalt,
    })
}

fn clusters_to_svg(
    view: &ClustersView,
    config: &ConverterConfig,
    mode: PathSimplifyMode,
    width: usize,
    height: usize,
) -> SvgFile {
    let mut svg = SvgFile::new(width, height, config.path_precision);
    for &cluster_index in view.clusters_output.iter().rev() {
        let cluster = view.get_cluster(cluster_index);
        let paths = cluster.to_compound_path(
            view,
            false,
            mode,
            config.corner_threshold,
            config.length_threshold,
            config.max_iterations,
            config.splice_threshold,
        );
        svg.add_path(paths, cluster.residue_color());
    }
    svg
}

fn trace_color(img: ColorImage, config: &ConverterConfig, mode: PathSimplifyMode) -> Result<SvgFile, JsValue> {
    let width = img.width;
    let height = img.height;
    let result = run_color_clusters(img, config)?;
    let view = result.clusters.view();
    Ok(clusters_to_svg(&view, config, mode, width, height))
}

fn trace_color_scene(
    img: ColorImage,
    config: &ConverterConfig,
    mode: PathSimplifyMode,
) -> Result<scene::SceneSvg, JsValue> {
    let width = img.width;
    let height = img.height;
    let result = run_color_clusters(img, config)?;
    let view = result.clusters.view();
    let pixel_gestalt = result.pixel_gestalt.as_deref();
    let mut traced = Vec::new();
    for &cluster_index in view.clusters_output.iter().rev() {
        let cluster = view.get_cluster(cluster_index);
        let paths = cluster.to_compound_path(
            &view,
            false,
            mode,
            config.corner_threshold,
            config.length_threshold,
            config.max_iterations,
            config.splice_threshold,
        );
        let gestalt_id = pixel_gestalt
            .map(|pg| cluster_gestalt_from_pixels(cluster, pg))
            .unwrap_or(0);
        traced.push(TracedCluster {
            cluster_index,
            path: paths,
            color: cluster.residue_color(),
            pixel_area: cluster.area(),
            gestalt_id,
        });
    }
    Ok(build_scene_from_clusters(
        &view,
        traced,
        config.filter_speckle_area,
        width,
        height,
        config.path_precision,
    ))
}

fn trace_binary(img: ColorImage, config: &ConverterConfig, mode: PathSimplifyMode) -> Result<SvgFile, JsValue> {
    let binary = img.to_binary_image(|x| x.r < 128);
    let width = binary.width;
    let height = binary.height;
    let clusters = binary.to_clusters(false);
    let mut svg = SvgFile::new(width, height, config.path_precision);
    for i in 0..clusters.len() {
        let cluster = clusters.get_cluster(i);
        if cluster.size() >= config.filter_speckle_area {
            let paths = cluster.to_compound_path(
                mode,
                config.corner_threshold,
                config.length_threshold,
                config.max_iterations,
                config.splice_threshold,
            );
            svg.add_path(paths, Color::color(&ColorName::Black));
        }
    }
    Ok(svg)
}

fn should_key_image(img: &ColorImage) -> bool {
    if img.width == 0 || img.height == 0 {
        return false;
    }
    let threshold = ((img.width * 2) as f32 * KEYING_THRESHOLD) as usize;
    let mut transparent = 0usize;
    for y in [0, img.height / 4, img.height / 2, 3 * img.height / 4, img.height - 1] {
        for x in 0..img.width {
            if img.get_pixel(x, y).a == 0 {
                transparent += 1;
            }
            if transparent >= threshold {
                return true;
            }
        }
    }
    false
}

fn find_unused_color_in_image(img: &ColorImage) -> Result<Color, String> {
    for color in [
        Color::new(255, 0, 0),
        Color::new(0, 255, 0),
        Color::new(0, 0, 255),
        Color::new(255, 255, 0),
        Color::new(0, 255, 255),
        Color::new(255, 0, 255),
    ] {
        if !color_exists_in_image(img, color) {
            return Ok(color);
        }
    }
    Err("unable to find unused color in image to use as key".into())
}

fn color_exists_in_image(img: &ColorImage, color: Color) -> bool {
    for y in 0..img.height {
        for x in 0..img.width {
            let p = img.get_pixel(x, y);
            if p.r == color.r && p.g == color.g && p.b == color.b {
                return true;
            }
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_config() -> TraceConfig {
        TraceConfig {
            binary: false,
            mode: "spline".into(),
            hierarchical: "stacked".into(),
            corner_threshold: 70.0,
            length_threshold: 4.0,
            max_iterations: 10,
            splice_threshold: 45.0,
            filter_speckle: 8,
            color_precision: 6,
            layer_difference: 16,
            path_precision: 8,
        }
    }

    #[test]
    fn converter_config_transforms_match_cli() {
        let c = into_converter_config(&sample_config());
        assert_eq!(c.filter_speckle_area, 64);
        assert_eq!(c.color_precision_loss, 2);
        assert!((c.corner_threshold - deg2rad(70.0)).abs() < 1e-9);
        assert!((c.splice_threshold - deg2rad(45.0)).abs() < 1e-9);
        assert_eq!(c.path_precision, Some(8));
    }

    #[test]
    fn cutout_flag_from_hierarchical() {
        let mut cfg = sample_config();
        cfg.hierarchical = "cutout".into();
        let c = into_converter_config(&cfg);
        assert!(c.hierarchical_cutout);
    }
}
