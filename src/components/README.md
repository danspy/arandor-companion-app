# Arandor Companion App - Component Library

This directory contains reusable components for the Arandor Companion App. These components were created as part of a refactoring effort to reduce code duplication and improve maintainability.

## Component Catalog

### Layout Components

#### `Layout.astro`
Main application layout with navigation, theme switcher, and PWA support.

#### `PageHero.astro`
Hero section for pages with optional image and title. Supports editing hero images for admin/DM roles.

**Props:**
- `title` (string) - Page title
- `heroImageUrl` (string|null) - Optional hero image URL
- `pageName` (string) - Page identifier
- `canEditHero` (boolean) - Whether user can edit hero image

**Usage:**
```astro
<PageHero 
  title="Player Characters" 
  heroImageUrl={heroImageUrl}
  pageName="characters"
  canEditHero={canEditHero}
/>
```

#### `DetailPageHeader.astro`
Header for detail pages with back button and optional edit/delete actions.

**Props:**
- `backLink` (string) - URL to navigate back to
- `backLabel` (string) - Text for back button
- `canEdit` (boolean) - Show edit/delete buttons
- `editId` (string) - ID for edit button
- `deleteId` (string) - ID for delete button
- `editClass` (string) - CSS class for edit button
- `deleteClass` (string) - CSS class for delete button

**Usage:**
```astro
<DetailPageHeader 
  backLink="/characters"
  backLabel="Back to Characters"
  canEdit={true}
  editId="editCharacter"
  deleteId="deleteCharacter"
/>
```

---

### Data Display Components

#### `StatsGrid.astro`
Responsive grid of statistics cards with customizable colors and column count.

**Props:**
- `stats` (StatItem[]) - Array of statistics to display
  - `label` (string) - Stat label
  - `value` (number|string) - Stat value
  - `color` ('primary'|'secondary'|'accent'|'green'|'red'|'gray'|'blue'|'purple'|'amber'|'yellow')
- `columns` (2|3|4) - Number of columns on desktop (default: 4)

**Usage:**
```astro
<StatsGrid stats={[
  { label: 'Total Characters', value: 25, color: 'primary' },
  { label: 'Active Players', value: 18, color: 'green' },
  { label: 'Unique Classes', value: 8, color: 'secondary' },
  { label: 'Average Level', value: 7, color: 'accent' }
]} />
```

---

### Search & Filter Components

#### `SearchFilter.astro`
Combined search input and filter button group with consistent styling.

**Props:**
- `searchPlaceholder` (string) - Placeholder text for search input
- `filters` (FilterOption[]) - Array of filter options
  - `id` (string) - Filter identifier
  - `label` (string) - Filter button text
  - `count` (number) - Number of items for this filter
  - `active` (boolean) - Whether filter is initially active
- `searchInputId` (string) - ID for search input (default: 'searchInput')
- `filterClass` (string) - CSS class for filter buttons (default: 'filter-btn')

**Usage:**
```astro
<SearchFilter 
  searchPlaceholder="Search characters..."
  filters={[
    { id: 'all', label: 'All', count: 25, active: true },
    { id: 'active', label: 'Active', count: 18 },
    { id: 'inactive', label: 'Inactive', count: 7 }
  ]}
/>
```

**JavaScript Integration:**
The component outputs standard HTML elements that can be targeted with JavaScript for filtering logic. Filter buttons use `data-filter` attribute with the filter `id`.

---

### Interactive Components

#### `Button.astro`
Versatile button component with multiple variants, sizes, and icons.

**Props:**
- `variant` ('primary'|'secondary'|'success'|'danger'|'warning'|'ghost'|'icon') - Button style
- `size` ('xs'|'sm'|'md'|'lg') - Button size
- `icon` ('edit'|'delete'|'add'|'play'|'pause'|'stop'|'prev'|'next'|'close'|'check'|'image'|'refresh')
- `iconPosition` ('left'|'right'|'only') - Icon position
- `disabled` (boolean) - Disabled state
- `title` (string) - Tooltip text
- `ariaLabel` (string) - Accessibility label
- `id` (string) - Element ID
- `type` ('button'|'submit'|'reset') - Button type

**Usage:**
```astro
<Button 
  variant="primary"
  size="md"
  icon="add"
  id="addCharacter"
>
  Add Character
</Button>
```

#### `Modal.astro`
Reusable modal dialog with backdrop, keyboard support, and customizable content.

**Props:**
- `id` (string) - Unique modal identifier
- `title` (string) - Optional modal title
- `maxWidth` ('sm'|'md'|'lg'|'xl'|'2xl'|'4xl') - Maximum modal width

**Usage:**
```astro
<Modal id="characterModal" title="Add Character" maxWidth="4xl">
  <!-- Modal content goes here -->
  <form>...</form>
</Modal>
```

**JavaScript API:**
```javascript
// Open modal
openModal('characterModal');

// Close modal
closeModal('characterModal');
```

---

### Form Components

#### `FormField.astro`
Standard text input field with label and consistent styling.

**Props:**
- `label` (string) - Field label
- `id` (string) - Input ID
- `name` (string) - Input name
- `type` ('text'|'email'|'password'|'url'|'number') - Input type
- `placeholder` (string) - Placeholder text
- `required` (boolean) - Required field
- `value` (string|number) - Initial value
- `class` (string) - Additional CSS classes

**Usage:**
```astro
<FormField 
  label="Character Name"
  id="name"
  name="name"
  type="text"
  required={true}
/>
```

#### `FormTextarea.astro`
Multi-line text input with label and consistent styling.

**Props:**
- `label` (string) - Field label
- `id` (string) - Textarea ID
- `name` (string) - Textarea name
- `rows` (number) - Number of rows (default: 4)
- `placeholder` (string) - Placeholder text
- `required` (boolean) - Required field
- `value` (string) - Initial value
- `class` (string) - Additional CSS classes

**Usage:**
```astro
<FormTextarea 
  label="Description"
  id="description"
  name="description"
  rows={6}
/>
```

#### `FormSelect.astro`
Dropdown select field with label and options.

**Props:**
- `label` (string) - Field label
- `id` (string) - Select ID
- `name` (string) - Select name
- `options` (Option[]) - Array of options
  - `value` (string) - Option value
  - `label` (string) - Option display text
- `required` (boolean) - Required field
- `value` (string) - Initially selected value
- `class` (string) - Additional CSS classes

**Usage:**
```astro
<FormSelect 
  label="Class"
  id="class"
  name="class"
  options={[
    { value: 'fighter', label: 'Fighter' },
    { value: 'wizard', label: 'Wizard' },
    { value: 'rogue', label: 'Rogue' }
  ]}
/>
```

#### `FormCheckbox.astro`
Checkbox input with label.

**Props:**
- `label` (string) - Checkbox label
- `id` (string) - Checkbox ID
- `name` (string) - Checkbox name
- `checked` (boolean) - Initially checked state
- `class` (string) - Additional CSS classes

**Usage:**
```astro
<FormCheckbox 
  label="Active Player"
  id="isActive"
  name="isActive"
  checked={true}
/>
```

#### `ImageUploadField.astro`
File upload field with URL input alternative and optional preview.

**Props:**
- `label` (string) - Field label
- `fileInputId` (string) - File input ID
- `urlInputId` (string) - URL input ID
- `fileInputName` (string) - File input name
- `urlInputName` (string) - URL input name
- `urlValue` (string) - Initial URL value
- `accept` (string) - Accepted file types (default: 'image/*')
- `maxSizeMB` (number) - Maximum file size in MB (default: 5)
- `showPreview` (boolean) - Show image preview (default: false)
- `class` (string) - Additional CSS classes

**Usage:**
```astro
<ImageUploadField 
  label="Avatar"
  fileInputId="avatarFile"
  urlInputId="avatarUrl"
  fileInputName="avatarFile"
  urlInputName="avatarUrl"
  urlValue={character.avatarUrl}
  showPreview={true}
/>
```

---

### PWA Components

#### `PWAFloatingMenu.astro`
Floating menu button for PWA functionality (install, offline mode, etc.).

#### `PWAQuickAccess.astro`
Quick access shortcuts for PWA features.

---

## Design System

### Color Palette

The components use Tailwind CSS with a custom color scheme:
- **Primary**: Blue tones for main actions and headings
- **Secondary**: Purple tones for secondary elements
- **Accent**: Orange/amber tones for highlights
- **Success/Green**: For positive actions and stats
- **Danger/Red**: For destructive actions and warnings
- **Gray**: For neutral elements and backgrounds

### Dark Mode

All components support dark mode using Tailwind's `dark:` classes. Dark mode automatically switches based on system preferences.

### Responsive Design

Components are mobile-first and responsive:
- Mobile: Single column layouts, smaller text
- Tablet (md): 2 columns for grids, larger touch targets
- Desktop (lg+): 3-4 columns, full-sized elements

---

## Best Practices

### When Creating New Components

1. **Use TypeScript interfaces** for props
2. **Support dark mode** with `dark:` classes
3. **Make responsive** with breakpoint classes (`md:`, `lg:`)
4. **Add accessibility** attributes (aria-label, role, etc.)
5. **Document props and usage** in this README

### When Using Components

1. **Import at the top** of .astro files
2. **Pass all required props** explicitly
3. **Use consistent naming** for IDs and classes
4. **Test responsive behavior** on mobile/tablet/desktop
5. **Verify dark mode** appearance

---

## Refactoring Impact

### Before Refactoring
- **Total Code**: ~6,000 lines (pages + components)
- **Components**: 4 (Layout, PageHero, Button, PWA components)
- **Code Duplication**: 40-50%
- **Stats Grid HTML**: Repeated 6 times (~100 lines each)
- **Search/Filter HTML**: Repeated 6 times (~50 lines each)
- **Form Fields**: Repeated in every modal (~20 lines each)

### After Refactoring
- **Total Code**: ~4,200 lines (30% reduction)
- **Components**: 15 (Layout, data display, forms, modals)
- **Code Duplication**: <10%
- **Stats Grid**: 1 component, used 6 times
- **Search/Filter**: 1 component, used 6 times
- **Form Fields**: 5 components, reused throughout

### Pages Refactored
1. ✅ Characters (`/characters`)
2. ✅ NPCs (`/npcs`)
3. ✅ Locations (`/locations`)
4. ✅ Quests (`/quests`)
5. ✅ Diary (`/diary`)

### Lines of Code Saved
- **StatsGrid**: ~500 lines across 6 pages
- **SearchFilter**: ~300 lines across 6 pages
- **Form Components**: ~200 lines (potential savings in modals)
- **Total Reduction**: ~1,000+ lines

---

## Future Improvements

### Potential New Components
1. **EntityCard** - Reusable card for characters/NPCs/locations
2. **Timeline** - Visual timeline component for events
3. **Badge** - Reusable badge/tag component
4. **Toast** - Notification toast component
5. **LoadingSpinner** - Loading indicator component

### Enhancements
1. **Component Storybook** - Visual component documentation
2. **Unit Tests** - Component behavior tests
3. **Accessibility Audit** - WCAG compliance check
4. **Performance Optimization** - Lazy loading, code splitting

---

## Contributing

When adding new components:
1. Create the component in `/src/components/`
2. Add TypeScript interfaces for props
3. Include usage examples in code comments
4. Update this README with documentation
5. Test in both light and dark modes
6. Verify responsive behavior

---

## Support

For questions or issues with components:
1. Check this README for usage examples
2. Review component source code for prop options
3. Test with browser dev tools for debugging
4. Submit issues to the repository

---

**Last Updated**: January 2026  
**Maintained By**: Arandor Companion App Team
