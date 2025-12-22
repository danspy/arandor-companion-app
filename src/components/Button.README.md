# Button Component

A flexible, reusable button component for the Arandor Companion App.

## Features

- 🎨 **7 Variants**: primary, secondary, success, danger, warning, ghost, icon
- 📏 **4 Sizes**: xs, sm, md, lg
- 🎯 **11 Built-in Icons**: edit, delete, add, play, pause, stop, prev, next, close, check, image
- 🎭 **Icon Positioning**: left, right, or icon-only
- ♿ **Accessible**: Built-in support for aria-labels and titles
- 🌙 **Dark Mode**: All variants support dark mode
- 🖱️ **Click-through Safe**: All icons have pointer-events-none

## Usage

```astro
import Button from '../components/Button.astro';
```

### Primary Action Buttons

```astro
<!-- With icon on left -->
<Button variant="primary" size="md" icon="add" id="addCharacter">
  Add Character
</Button>

<!-- With icon on right -->
<Button variant="primary" size="md" icon="next" iconPosition="right">
  Next Step
</Button>

<!-- Text only -->
<Button variant="primary" size="md">
  Submit
</Button>
```

### Icon-Only Buttons

```astro
<!-- Edit button -->
<Button 
  variant="icon" 
  size="md" 
  icon="edit" 
  iconPosition="only"
  title="Edit character"
  ariaLabel="Edit character"
  class="edit-character"
  data-id={character.id}
/>

<!-- Delete button (with custom hover color) -->
<Button 
  variant="ghost" 
  size="md" 
  icon="delete" 
  iconPosition="only"
  title="Delete character"
  ariaLabel="Delete character"
  class="delete-character hover:text-red-600 dark:hover:text-red-400"
  data-id={character.id}
/>
```

### Status/Action Buttons

```astro
<!-- Success variant -->
<Button variant="success" size="sm" icon="play" id="startCombatBtn">
  Start
</Button>

<!-- Warning variant -->
<Button variant="warning" size="sm" icon="pause" id="pauseCombatBtn">
  Pause
</Button>

<!-- Danger variant -->
<Button variant="danger" size="sm" icon="stop" id="stopCombatBtn">
  Stop
</Button>
```

### Navigation Buttons

```astro
<!-- Previous -->
<Button variant="secondary" size="sm" icon="prev" id="prevBtn">
  Previous
</Button>

<!-- Next -->
<Button variant="secondary" size="sm" icon="next" iconPosition="right" id="nextBtn">
  Next
</Button>
```

### Form Buttons

```astro
<!-- Submit -->
<Button type="submit" variant="primary" size="md" icon="check">
  Save
</Button>

<!-- Cancel -->
<Button type="button" variant="secondary" size="md" icon="close">
  Cancel
</Button>
```

### Disabled State

```astro
<Button variant="primary" size="md" disabled={true}>
  Loading...
</Button>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'success' \| 'danger' \| 'warning' \| 'ghost' \| 'icon'` | `'primary'` | Button style variant |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg'` | `'md'` | Button size |
| `icon` | `'edit' \| 'delete' \| 'add' \| 'play' \| 'pause' \| 'stop' \| 'prev' \| 'next' \| 'close' \| 'check' \| 'image'` | `undefined` | Icon to display |
| `iconPosition` | `'left' \| 'right' \| 'only'` | `'left'` | Icon position relative to text |
| `class` | `string` | `''` | Additional CSS classes |
| `disabled` | `boolean` | `false` | Disable the button |
| `title` | `string` | `undefined` | Tooltip text |
| `ariaLabel` | `string` | `undefined` | Accessibility label |
| `id` | `string` | `undefined` | Button ID |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | Button type |

## Variants

### `primary`
Default action button with primary color scheme.

### `secondary`
Secondary action button with gray color scheme.

### `success`
Positive action button with green color scheme (e.g., Start, Complete).

### `danger`
Destructive action button with red color scheme (e.g., Delete, Stop).

### `warning`
Warning action button with yellow color scheme (e.g., Pause, Caution).

### `ghost`
Subtle button with hover background, ideal for icon-only buttons.

### `icon`
Similar to ghost but optimized for icon-only buttons in cards/lists.

## Sizes

| Size | Padding (with text) | Padding (icon-only) | Icon Size | Text Size |
|------|---------------------|---------------------|-----------|-----------|
| `xs` | `px-2 py-1` | `p-1.5` | `w-3 h-3` | `text-xs` |
| `sm` | `px-3 py-1.5` | `p-2` | `w-4 h-4` | `text-sm` |
| `md` | `px-4 py-2` | `p-2.5` | `w-5 h-5` | `text-base` |
| `lg` | `px-5 py-2.5` | `p-3` | `w-6 h-6` | `text-lg` |

Note: Icon-only buttons use slightly larger icons for better visibility.

## Icons

Available icons:
- `edit` - Pencil/edit icon
- `delete` - Trash/delete icon
- `add` - Plus/add icon
- `play` - Play button (circle with triangle)
- `pause` - Pause button (circle with parallel lines)
- `stop` - Stop button (circle with square)
- `prev` - Chevron left arrow
- `next` - Chevron right arrow
- `close` - X/close icon
- `check` - Checkmark icon
- `image` - Image/photo icon

## Examples

### Character Card Actions

```astro
<div class="flex gap-3 mt-3 justify-end border-t pt-3">
  <Button 
    variant="icon" 
    size="md" 
    icon="edit" 
    iconPosition="only"
    title="Edit character"
    ariaLabel="Edit character"
    class="edit-character"
    data-id={character.id}
  />
  <Button 
    variant="ghost" 
    size="md" 
    icon="delete" 
    iconPosition="only"
    title="Delete character"
    ariaLabel="Delete character"
    class="delete-character hover:text-red-600 dark:hover:text-red-400"
    data-id={character.id}
  />
</div>
```

### Initiative Tracker Controls

```astro
<div class="flex gap-2">
  <Button variant="success" size="sm" icon="play" id="startCombatBtn">
    Start
  </Button>
  <Button variant="warning" size="sm" icon="pause" id="pauseCombatBtn">
    Pause
  </Button>
  <Button variant="danger" size="sm" icon="stop" id="stopCombatBtn">
    Stop
  </Button>
</div>
```

### Add Button

```astro
<Button variant="primary" size="md" icon="add" id="addCharacter">
  Add Character
</Button>
```

## Migration Guide

To migrate existing buttons to use the Button component:

**Before:**
```astro
<button 
  class="p-2.5 text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition cursor-pointer"
  data-id={character.id}
  title="Edit character"
  aria-label="Edit character"
>
  <svg class="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
  </svg>
</button>
```

**After:**
```astro
<Button 
  variant="icon" 
  size="md" 
  icon="edit" 
  iconPosition="only"
  title="Edit character"
  ariaLabel="Edit character"
  data-id={character.id}
/>
```

## Benefits

1. **Consistency**: All buttons follow the same design patterns
2. **Maintainability**: Update button styles in one place
3. **Type Safety**: TypeScript interface ensures correct prop usage
4. **Accessibility**: Built-in aria-label and title support
5. **Developer Experience**: Easy to use, self-documenting API
6. **Performance**: No additional JavaScript, pure Astro component
