//! Terminal themes including popular iTerm2 themes.

use crate::types::Color;
use serde::{Deserialize, Serialize};

/// Terminal color theme.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Theme {
    pub name: String,
    pub foreground: Color,
    pub background: Color,
    pub cursor: Color,
    pub cursor_text: Color,
    pub selection: Color,
    pub selection_text: Color,

    // Standard ANSI colors
    pub black: Color,
    pub red: Color,
    pub green: Color,
    pub yellow: Color,
    pub blue: Color,
    pub magenta: Color,
    pub cyan: Color,
    pub white: Color,

    // Bright variants
    pub bright_black: Color,
    pub bright_red: Color,
    pub bright_green: Color,
    pub bright_yellow: Color,
    pub bright_blue: Color,
    pub bright_magenta: Color,
    pub bright_cyan: Color,
    pub bright_white: Color,
}

impl Default for Theme {
    fn default() -> Self {
        DARK.clone()
    }
}

/// Dark theme (default).
pub static DARK: Theme = Theme {
    name: String::new(), // Will be set at runtime
    foreground: Color::new(229, 229, 229),
    background: Color::new(24, 24, 27),
    cursor: Color::new(255, 255, 255),
    cursor_text: Color::new(0, 0, 0),
    selection: Color::new(68, 68, 76),
    selection_text: Color::new(255, 255, 255),
    black: Color::new(0, 0, 0),
    red: Color::new(205, 49, 49),
    green: Color::new(13, 188, 121),
    yellow: Color::new(229, 229, 16),
    blue: Color::new(36, 114, 200),
    magenta: Color::new(188, 63, 188),
    cyan: Color::new(17, 168, 205),
    white: Color::new(229, 229, 229),
    bright_black: Color::new(102, 102, 102),
    bright_red: Color::new(241, 76, 76),
    bright_green: Color::new(35, 209, 139),
    bright_yellow: Color::new(245, 245, 67),
    bright_blue: Color::new(59, 142, 234),
    bright_magenta: Color::new(214, 112, 214),
    bright_cyan: Color::new(41, 184, 219),
    bright_white: Color::new(255, 255, 255),
};

/// Light theme.
pub static LIGHT: Theme = Theme {
    name: String::new(),
    foreground: Color::new(0, 0, 0),
    background: Color::new(255, 255, 255),
    cursor: Color::new(0, 0, 0),
    cursor_text: Color::new(255, 255, 255),
    selection: Color::new(178, 215, 255),
    selection_text: Color::new(0, 0, 0),
    black: Color::new(0, 0, 0),
    red: Color::new(205, 49, 49),
    green: Color::new(0, 128, 0),
    yellow: Color::new(128, 128, 0),
    blue: Color::new(0, 0, 255),
    magenta: Color::new(128, 0, 128),
    cyan: Color::new(0, 128, 128),
    white: Color::new(192, 192, 192),
    bright_black: Color::new(128, 128, 128),
    bright_red: Color::new(255, 0, 0),
    bright_green: Color::new(0, 255, 0),
    bright_yellow: Color::new(255, 255, 0),
    bright_blue: Color::new(0, 0, 255),
    bright_magenta: Color::new(255, 0, 255),
    bright_cyan: Color::new(0, 255, 255),
    bright_white: Color::new(255, 255, 255),
};

/// Solarized Dark theme.
pub static SOLARIZED_DARK: Theme = Theme {
    name: String::new(),
    foreground: Color::new(131, 148, 150),
    background: Color::new(0, 43, 54),
    cursor: Color::new(131, 148, 150),
    cursor_text: Color::new(0, 43, 54),
    selection: Color::new(7, 54, 66),
    selection_text: Color::new(131, 148, 150),
    black: Color::new(7, 54, 66),
    red: Color::new(220, 50, 47),
    green: Color::new(133, 153, 0),
    yellow: Color::new(181, 137, 0),
    blue: Color::new(38, 139, 210),
    magenta: Color::new(211, 54, 130),
    cyan: Color::new(42, 161, 152),
    white: Color::new(238, 232, 213),
    bright_black: Color::new(0, 43, 54),
    bright_red: Color::new(203, 75, 22),
    bright_green: Color::new(88, 110, 117),
    bright_yellow: Color::new(101, 123, 131),
    bright_blue: Color::new(131, 148, 150),
    bright_magenta: Color::new(108, 113, 196),
    bright_cyan: Color::new(147, 161, 161),
    bright_white: Color::new(253, 246, 227),
};

/// Dracula theme.
pub static DRACULA: Theme = Theme {
    name: String::new(),
    foreground: Color::new(248, 248, 242),
    background: Color::new(40, 42, 54),
    cursor: Color::new(248, 248, 242),
    cursor_text: Color::new(40, 42, 54),
    selection: Color::new(68, 71, 90),
    selection_text: Color::new(248, 248, 242),
    black: Color::new(33, 34, 44),
    red: Color::new(255, 85, 85),
    green: Color::new(80, 250, 123),
    yellow: Color::new(241, 250, 140),
    blue: Color::new(98, 114, 164),
    magenta: Color::new(255, 121, 198),
    cyan: Color::new(139, 233, 253),
    white: Color::new(248, 248, 242),
    bright_black: Color::new(98, 114, 164),
    bright_red: Color::new(255, 110, 103),
    bright_green: Color::new(90, 247, 142),
    bright_yellow: Color::new(244, 249, 157),
    bright_blue: Color::new(119, 136, 189),
    bright_magenta: Color::new(255, 146, 208),
    bright_cyan: Color::new(154, 237, 254),
    bright_white: Color::new(255, 255, 255),
};

/// Nord theme.
pub static NORD: Theme = Theme {
    name: String::new(),
    foreground: Color::new(216, 222, 233),
    background: Color::new(46, 52, 64),
    cursor: Color::new(216, 222, 233),
    cursor_text: Color::new(46, 52, 64),
    selection: Color::new(67, 76, 94),
    selection_text: Color::new(216, 222, 233),
    black: Color::new(59, 66, 82),
    red: Color::new(191, 97, 106),
    green: Color::new(163, 190, 140),
    yellow: Color::new(235, 203, 139),
    blue: Color::new(129, 161, 193),
    magenta: Color::new(180, 142, 173),
    cyan: Color::new(136, 192, 208),
    white: Color::new(229, 233, 240),
    bright_black: Color::new(76, 86, 106),
    bright_red: Color::new(191, 97, 106),
    bright_green: Color::new(163, 190, 140),
    bright_yellow: Color::new(235, 203, 139),
    bright_blue: Color::new(129, 161, 193),
    bright_magenta: Color::new(180, 142, 173),
    bright_cyan: Color::new(143, 188, 187),
    bright_white: Color::new(236, 239, 244),
};

/// One Dark theme.
pub static ONE_DARK: Theme = Theme {
    name: String::new(),
    foreground: Color::new(171, 178, 191),
    background: Color::new(40, 44, 52),
    cursor: Color::new(82, 139, 255),
    cursor_text: Color::new(40, 44, 52),
    selection: Color::new(62, 68, 81),
    selection_text: Color::new(171, 178, 191),
    black: Color::new(40, 44, 52),
    red: Color::new(224, 108, 117),
    green: Color::new(152, 195, 121),
    yellow: Color::new(229, 192, 123),
    blue: Color::new(97, 175, 239),
    magenta: Color::new(198, 120, 221),
    cyan: Color::new(86, 182, 194),
    white: Color::new(171, 178, 191),
    bright_black: Color::new(92, 99, 112),
    bright_red: Color::new(224, 108, 117),
    bright_green: Color::new(152, 195, 121),
    bright_yellow: Color::new(229, 192, 123),
    bright_blue: Color::new(97, 175, 239),
    bright_magenta: Color::new(198, 120, 221),
    bright_cyan: Color::new(86, 182, 194),
    bright_white: Color::new(255, 255, 255),
};

/// All available themes.
pub static THEMES: &[(&str, &Theme)] = &[
    ("dark", &DARK),
    ("light", &LIGHT),
    ("solarized-dark", &SOLARIZED_DARK),
    ("dracula", &DRACULA),
    ("nord", &NORD),
    ("one-dark", &ONE_DARK),
];

impl Theme {
    /// Get a theme by name.
    pub fn by_name(name: &str) -> Option<Theme> {
        THEMES.iter()
            .find(|(n, _)| *n == name)
            .map(|(n, t)| {
                let mut theme = (*t).clone();
                theme.name = n.to_string();
                theme
            })
    }

    /// Get color by ANSI index.
    pub fn color_by_index(&self, idx: u8) -> Color {
        match idx {
            0 => self.black,
            1 => self.red,
            2 => self.green,
            3 => self.yellow,
            4 => self.blue,
            5 => self.magenta,
            6 => self.cyan,
            7 => self.white,
            8 => self.bright_black,
            9 => self.bright_red,
            10 => self.bright_green,
            11 => self.bright_yellow,
            12 => self.bright_blue,
            13 => self.bright_magenta,
            14 => self.bright_cyan,
            15 => self.bright_white,
            _ => Color::new(255, 255, 255),
        }
    }
}
