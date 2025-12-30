//! Terminal emulation using vt100.

use crate::types::{Cell, CellAttributes, CellChange, Color, Cursor, CursorPosition, CursorShape, Row, Screen, Size};
use parking_lot::Mutex;
use std::sync::Arc;

/// A terminal emulator backed by vt100.
pub struct Terminal {
    parser: Arc<Mutex<vt100::Parser>>,
    size: Size,
    title: String,
    /// Previous screen state for diffing.
    prev_contents: Arc<Mutex<Option<String>>>,
}

impl Terminal {
    /// Create a new terminal with the given size.
    pub fn new(cols: u16, rows: u16) -> Self {
        let parser = vt100::Parser::new(rows, cols, 10000); // 10k scrollback
        Self {
            parser: Arc::new(Mutex::new(parser)),
            size: Size { cols, rows },
            title: String::new(),
            prev_contents: Arc::new(Mutex::new(None)),
        }
    }

    /// Process input data from PTY.
    pub fn process(&mut self, data: &[u8]) -> Vec<CellChange> {
        let mut parser = self.parser.lock();
        parser.process(data);

        let screen = parser.screen();

        // Update title if changed
        let title_str = screen.title();
        if !title_str.is_empty() {
            self.title = title_str.to_string();
        }

        // Get current contents for diffing
        let current = screen.contents();
        let mut prev = self.prev_contents.lock();

        let changes = if prev.as_ref() != Some(&current) {
            // Content changed, compute full diff
            self.compute_changes(screen)
        } else {
            Vec::new()
        };

        *prev = Some(current);
        changes
    }

    fn compute_changes(&self, screen: &vt100::Screen) -> Vec<CellChange> {
        let mut changes = Vec::new();

        for row in 0..self.size.rows {
            for col in 0..self.size.cols {
                if let Some(cell) = screen.cell(row, col) {
                    changes.push(CellChange {
                        row,
                        col,
                        cell: self.convert_cell(cell),
                    });
                }
            }
        }

        changes
    }

    /// Get the full screen state.
    pub fn get_screen(&self) -> Screen {
        let parser = self.parser.lock();
        let screen = parser.screen();

        let cells: Vec<Row> = (0..self.size.rows)
            .map(|row| {
                (0..self.size.cols)
                    .map(|col| self.cell_at(screen, row, col))
                    .collect()
            })
            .collect();

        Screen {
            cells,
            cursor: self.get_cursor_from_screen(screen),
            size: self.size,
            scrollback_len: screen.scrollback() as u32,
            title: screen.title().to_string(),
        }
    }

    /// Get scrollback lines.
    pub fn get_scrollback(&self, lines: u32) -> Vec<Row> {
        let parser = self.parser.lock();
        let screen = parser.screen();
        let scrollback = screen.scrollback();

        let start = scrollback.saturating_sub(lines as usize);
        let _end = scrollback;

        // vt100 0.15 doesn't have scrollback_cell, return empty for now
        // In production, we'd use screen.rows_formatted() or similar
        Vec::new()
    }

    /// Resize the terminal.
    pub fn resize(&mut self, cols: u16, rows: u16) {
        self.size = Size { cols, rows };
        let mut parser = self.parser.lock();
        parser.set_size(rows, cols);

        // Clear prev_contents cache to force a full refresh after resize
        // This ensures the frontend gets the complete new screen state
        let mut prev = self.prev_contents.lock();
        *prev = None;
    }

    /// Get cursor state.
    pub fn get_cursor(&self) -> Cursor {
        let parser = self.parser.lock();
        self.get_cursor_from_screen(parser.screen())
    }

    /// Get the current title.
    pub fn title(&self) -> &str {
        &self.title
    }

    /// Get terminal size.
    pub fn size(&self) -> Size {
        self.size
    }

    /// Check if bell was rung (not directly exposed in vt100 0.15).
    pub fn check_bell(&self) -> bool {
        // vt100 0.15 doesn't expose audible_bell() directly
        // Would need to track escape sequences ourselves
        false
    }

    // Private helpers

    fn get_cursor_from_screen(&self, screen: &vt100::Screen) -> Cursor {
        let (row, col) = screen.cursor_position();
        Cursor {
            position: CursorPosition {
                row: row as u16,
                col: col as u16,
            },
            visible: !screen.hide_cursor(),
            shape: CursorShape::Block, // vt100 doesn't track cursor shape
        }
    }

    fn cell_at(&self, screen: &vt100::Screen, row: u16, col: u16) -> Cell {
        match screen.cell(row, col) {
            Some(c) => self.convert_cell(c),
            None => Cell::default(),
        }
    }

    fn convert_cell(&self, cell: &vt100::Cell) -> Cell {
        let default_fg = Color::new(255, 255, 255);
        let default_bg = Color::new(0, 0, 0);

        Cell {
            char: cell.contents().to_string(),
            fg: Color::from_vt100(cell.fgcolor(), default_fg),
            bg: Color::from_vt100(cell.bgcolor(), default_bg),
            attrs: CellAttributes::from_vt100_cell(cell),
        }
    }
}

impl Clone for Terminal {
    fn clone(&self) -> Self {
        // Clone creates a fresh terminal with same size
        Self::new(self.size.cols, self.size.rows)
    }
}
