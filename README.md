# Tales Runner Color Picker

A browser-based tool for Tales Runner players to extract dye values directly from images. No installation required — open and use.

Discord: afallen
Access the tool here: [Tales Runner Fashion Assist](https://raphallen.github.io/gtrdyepicker/)
[Buy me a coffee](https://ko-fi.com/N4N61R1V56)

---

## Versions

### v1 — Color Picker

The original tool. Load an image, click a pixel, get the game values instantly.

- Outputs **Color**, **Intensity**, and **Brightness** on the 0–512 game scale
- Magnifier for precise pixel targeting
- Accepts any image format

### v2 — Fashion Assist

A full redesign focused on fashion planning and outfit building.

---

## v2 Features

**Color Picking**
- Load PNG or JPG/JPEG images via file picker, drag and drop, or click the drop icon
- Click any pixel to extract its Color, Intensity and Brightness values (0–512 scale)
- Hover over the image to preview values in real time without committing
- Magnifier follows the cursor for precise picking
- Copy individual values (Color, Intensity, Brightness) or all three at once

**Zoom and Pan**
- Zoom in/out with the `+` / `−` toolbar buttons or the mouse wheel
- `FIT` button resets zoom and pan to default
- Hold `Shift` and drag to pan the image — cursor switches to a grab hand automatically
- Zoom range: 50% to 500%

**Suggested Colors**
- After picking a color, four suggestion rows appear automatically:
  - Light Tone — lighter, desaturated variants
  - Dark Tone — deeper shades
  - Soft Match — nearby hues that blend naturally
  - Neutral — washed-out and near-white pairings
- Hover a suggestion to preview it without adding to the palette
- Click a suggestion to add it to the palette and update suggestions based on it
- **Add All** button adds all 8 suggestions to the palette at once

**Palette**
- Picked colors are saved to a palette with their game values
- Add a custom name and note to each entry
- Drag entries to reorder them
- Click an entry to reload it into the display and refresh suggestions
- Copy values directly from a palette entry with the copy button
- Duplicate an entry with the duplicate button
- Delete an entry — an **Undo** button appears in the toast for 4 seconds
- Keyboard navigation: `Tab` to focus entries, `Enter` to select, `Delete`/`Backspace` to remove

**Export**
- **JSON** — exports all palette entries with Color, Intensity, Brightness, name, note, and a timestamp
- **PNG** — exports a grid of color swatches (up to 4 per row) with values, names and notes rendered below each swatch
- **Load JSON** — load a previously saved palette, with options to merge or replace the current one

---

These pages work entirely in the browser. No server, no dependencies, no data leaves your machine.
