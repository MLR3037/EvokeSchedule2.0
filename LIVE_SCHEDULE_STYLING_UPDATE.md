# Live Schedule Styling Update - November 19, 2025

## Changes Made

### Visual Improvements

1. **Removed strikethrough text** - Absent rows now just have gray background
2. **Darker gray background** - Changed from `bg-gray-200 opacity-60` to `bg-gray-300`
3. **Darker text for absent rows** - Changed from `text-gray-500` to `text-gray-600`
4. **ABSENT text stays red** - `text-red-600 font-semibold` (highly visible)
5. **OUT text stays orange** - `text-orange-600 font-semibold`
6. **Grayed input boxes for absent rows** - Inputs now have `bg-gray-300 border-gray-400` when student is absent (looks disabled)

### Size Reductions for Better Screenshots

1. **Smaller font throughout**:
   - Headers: `text-xs` (12px)
   - Table cells: `text-xs` (12px)
   - Input fields: `text-xs` (11px in popup)

2. **Reduced padding**:
   - Table cells: `px-3 py-1` (was `px-4 py-3`)
   - Header cells: `px-3 py-2` (was `px-4 py-3`)
   - Input cells: `px-2 py-1` (was `px-4 py-3`)

3. **Smaller input boxes**:
   - Max width: `max-w-[65px]` (prevents overflow)
   - Reduced padding: `px-1 py-0.5` (was `px-2 py-1`)
   - Fits nicely in Lunch Cov and PM End columns

4. **Tighter row spacing**:
   - Cell padding: `py-1` (was `py-3`)
   - Allows ~30-35 students visible at once (good for Primary program)

## Taking Screenshots for All-Staff Chat

### Option 1: Browser Screenshot Tools

**Windows:**
- Press `Windows + Shift + S` to open Snipping Tool
- Select "Rectangular Snip" and capture the visible portion
- For longer captures, scroll and take multiple screenshots

**Chrome Extension - "Full Page Screen Capture":**
1. Install from Chrome Web Store
2. Click extension icon
3. It automatically scrolls and captures entire page
4. Downloads as PNG image

**Firefox - Built-in Screenshot:**
1. Right-click on page → "Take Screenshot"
2. Choose "Save full page" for scrolling capture
3. Or "Save visible" for current view

### Option 2: Print to PDF

1. **In the Live Schedule popup window**, press `Ctrl + P` (Print)
2. Choose "Save as PDF" as printer
3. Adjust settings:
   - Layout: Landscape (shows more columns)
   - Scale: 80-90% (fits better)
   - Margins: None
4. Save PDF and share in Teams chat

### Option 3: Windows Snip & Sketch

1. Open "Snip & Sketch" app (Windows 10/11)
2. Click "New" → "Rectangular Snip"
3. Capture the Live Schedule window
4. Annotate if needed
5. Copy or save to share

### Best Practice for All-Staff Chat

**Recommended workflow:**
1. Filter to "Primary" program only
2. Sort by "Name"  
3. Open in New Window (fills screen nicely)
4. Use Chrome "Full Page Screen Capture" extension for entire list
5. Or use Windows Snipping Tool for visible portion
6. Paste directly into Teams chat or save as PNG

**Pro tip:** The tighter spacing now allows most Primary students to fit on one screen, making screenshots much easier!

## File Modified

- `src/components/LiveScheduleView.js`
  - Updated table cell classes for tighter spacing
  - Updated input field sizing and styling
  - Updated absent row styling (removed strikethrough, adjusted colors)
  - Applied same changes to both in-app view and popup window

## Example Styling

### Before:
```jsx
<td className="px-4 py-3 whitespace-nowrap text-sm">
  <input className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
</td>
```

### After:
```jsx
<td className="px-2 py-1 whitespace-nowrap">
  <input className="w-full max-w-[65px] px-1 py-0.5 border rounded text-xs" />
</td>
```

### Absent Row Styling:
```jsx
// Row background
className={isAbsent ? 'bg-gray-300' : 'hover:bg-gray-50'}

// Text color
className={isAbsent ? 'text-gray-600' : 'text-gray-900'}

// Input styling
className={isAbsent ? 'bg-gray-300 border-gray-400' : 'bg-white border-gray-300'}

// ABSENT text stays red
{row.amStaff === 'ABSENT' ? 'text-red-600 font-semibold' : 'text-gray-900'}
```
