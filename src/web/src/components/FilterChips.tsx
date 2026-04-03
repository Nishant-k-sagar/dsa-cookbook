import './FilterChips.css';

type FilterChipVariant = 'default' | 'easy' | 'medium' | 'hard';

interface FilterChip<T extends string> {
  value: T;
  label: string;
  variant?: FilterChipVariant;
}

interface FilterChipsProps<T extends string> {
  chips: FilterChip<T>[];
  selectedValue: T;
  onChange: (value: T) => void;
  label?: string;
}

export function FilterChips<T extends string>({
  chips,
  selectedValue,
  onChange,
  label,
}: FilterChipsProps<T>) {
  return (
    <div className="filter-chips" role="group" aria-label={label || 'Filters'}>
      {chips.map((chip) => (
        <button
          key={chip.value}
          type="button"
          className={`filter-chip ${selectedValue === chip.value ? `is-active${chip.variant ? ` filter-chip--${chip.variant}` : ''}` : ''}`}
          onClick={() => onChange(chip.value)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
