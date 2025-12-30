//! Common types used throughout the terminal plugin.

use serde::{Deserialize, Serialize};

/// Terminal dimensions.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct Size {
    pub cols: u16,
    pub rows: u16,
}

impl Default for Size {
    fn default() -> Self {
        Self { cols: 80, rows: 24 }
    }
}

/// Cursor position.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct CursorPosition {
    pub row: u16,
    pub col: u16,
}

/// Cursor state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cursor {
    pub position: CursorPosition,
    pub visible: bool,
    pub shape: CursorShape,
}

impl Default for Cursor {
    fn default() -> Self {
        Self {
            position: CursorPosition::default(),
            visible: true,
            shape: CursorShape::Block,
        }
    }
}

/// Cursor shape variants.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CursorShape {
    #[default]
    Block,
    Underline,
    Bar,
}

/// RGB color.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

impl Color {
    pub const fn new(r: u8, g: u8, b: u8) -> Self {
        Self { r, g, b }
    }

    pub fn to_css(&self) -> String {
        format!("rgb({}, {}, {})", self.r, self.g, self.b)
    }

    pub fn to_hex(&self) -> String {
        format!("#{:02x}{:02x}{:02x}", self.r, self.g, self.b)
    }

    /// Convert from vt100 color.
    pub fn from_vt100(c: vt100::Color, default: Color) -> Self {
        match c {
            vt100::Color::Default => default,
            vt100::Color::Idx(i) => idx_to_color(i),
            vt100::Color::Rgb(r, g, b) => Color::new(r, g, b),
        }
    }
}

/// Convert 256-color index to RGB.
fn idx_to_color(idx: u8) -> Color {
    match idx {
        // Standard colors (0-15)
        0 => Color::new(0, 0, 0),        // Black
        1 => Color::new(205, 49, 49),    // Red
        2 => Color::new(13, 188, 121),   // Green
        3 => Color::new(229, 229, 16),   // Yellow
        4 => Color::new(36, 114, 200),   // Blue
        5 => Color::new(188, 63, 188),   // Magenta
        6 => Color::new(17, 168, 205),   // Cyan
        7 => Color::new(229, 229, 229),  // White
        8 => Color::new(102, 102, 102),  // Bright Black
        9 => Color::new(241, 76, 76),    // Bright Red
        10 => Color::new(35, 209, 139),  // Bright Green
        11 => Color::new(245, 245, 67),  // Bright Yellow
        12 => Color::new(59, 142, 234),  // Bright Blue
        13 => Color::new(214, 112, 214), // Bright Magenta
        14 => Color::new(41, 184, 219),  // Bright Cyan
        15 => Color::new(255, 255, 255), // Bright White
        // 216 color cube (16-231)
        16..=231 => {
            let n = idx - 16;
            let r = ((n / 36) % 6) * 51;
            let g = ((n / 6) % 6) * 51;
            let b = (n % 6) * 51;
            Color::new(r, g, b)
        }
        // Grayscale (232-255)
        232..=255 => {
            let gray = (idx - 232) * 10 + 8;
            Color::new(gray, gray, gray)
        }
    }
}

/// Cell attributes (bold, italic, etc.).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct CellAttributes {
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub strikethrough: bool,
    pub inverse: bool,
    pub dim: bool,
    pub blink: bool,
}

impl CellAttributes {
    /// Create from vt100 cell.
    pub fn from_vt100_cell(cell: &vt100::Cell) -> Self {
        Self {
            bold: cell.bold(),
            italic: cell.italic(),
            underline: cell.underline(),
            strikethrough: false,
            inverse: cell.inverse(),
            dim: false,
            blink: false,
        }
    }
}

/// A single terminal cell.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cell {
    pub char: String,
    pub fg: Color,
    pub bg: Color,
    pub attrs: CellAttributes,
}

impl Default for Cell {
    fn default() -> Self {
        Self {
            char: " ".to_string(),
            fg: Color::new(255, 255, 255),
            bg: Color::new(0, 0, 0),
            attrs: CellAttributes::default(),
        }
    }
}

/// A row of cells.
pub type Row = Vec<Cell>;

/// The entire screen buffer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Screen {
    pub cells: Vec<Row>,
    pub cursor: Cursor,
    pub size: Size,
    pub scrollback_len: u32,
    pub title: String,
}

/// A change to a single cell (for incremental updates).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CellChange {
    pub row: u16,
    pub col: u16,
    pub cell: Cell,
}

/// Incremental screen update.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenUpdate {
    pub session_id: String,
    pub changes: Vec<CellChange>,
    pub cursor: Cursor,
    pub title: Option<String>,
}

/// Shell integration mark.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mark {
    pub row: u32,
    pub timestamp: u64,
    pub mark_type: MarkType,
    pub command: Option<String>,
    pub exit_code: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MarkType {
    PromptStart,
    CommandStart,
    CommandEnd,
}
