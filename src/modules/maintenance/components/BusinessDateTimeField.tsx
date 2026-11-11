import { useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { es } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { timestamp } from '../../../../shared/relational';
import { styles } from '../../../components/styles';

export function BusinessDateTimeField({
  label,
  value,
  onChange,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dateInput = useRef<HTMLInputElement>(null);
  const [date = '', time = ''] = value.split('T');
  const display = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('/') : date;
  const validDate = timestamp.safeParse(`${date}T00:00`).success;
  const selected = validDate ? new Date(`${date}T12:00:00`) : undefined;
  return (
    <fieldset className="sm-business-datetime">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1 text-sm">
          Fecha (DD/MM/AAAA)
          <input
            className={styles.input + ' mt-1'}
            ref={dateInput}
            type="text"
            inputMode="numeric"
            placeholder="DD/MM/AAAA"
            pattern="\d{2}/\d{2}/\d{4}"
            maxLength={10}
            required={required}
            value={display}
            onChange={event => {
              const input = event.target.value;
              const iso = /^\d{2}\/\d{2}\/\d{4}$/.test(input)
                ? input.split('/').reverse().join('-')
                : input;
              event.currentTarget.setCustomValidity(
                input && !timestamp.safeParse(`${iso}T00:00`).success
                  ? 'Ingresa una fecha válida en formato DD/MM/AAAA.'
                  : ''
              );
              onChange(`${iso}T${time}`);
            }}
          />
        </label>
        <button
          type="button"
          className="sm-record-action"
          aria-label="Abrir calendario"
          aria-expanded={open}
          onClick={() => setOpen(current => !current)}
        >
          <CalendarDays size={17} aria-hidden />
        </button>
        <label className="text-sm">
          Hora
          <input
            className={styles.input + ' mt-1'}
            type="time"
            step="1"
            required={required}
            value={time}
            onInput={event => onChange(`${date}T${event.currentTarget.value}`)}
          />
        </label>
      </div>
      {open && (
        <div
          className="sm-date-picker"
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              setOpen(false);
            }
          }}
        >
          <DayPicker
            locale={es}
            labels={{
              labelNext: () => 'Mes siguiente',
              labelPrevious: () => 'Mes anterior',
              labelDayButton: (day, modifiers) =>
                [
                  new Intl.DateTimeFormat('es-EC', { dateStyle: 'full' }).format(day),
                  modifiers.today ? 'hoy' : '',
                  modifiers.selected ? 'seleccionado' : '',
                ]
                  .filter(Boolean)
                  .join(', '),
            }}
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={day => {
              if (!day) return;
              dateInput.current?.setCustomValidity('');
              const iso = [
                String(day.getFullYear()).padStart(4, '0'),
                String(day.getMonth() + 1).padStart(2, '0'),
                String(day.getDate()).padStart(2, '0'),
              ].join('-');
              onChange(`${iso}T${time}`);
              setOpen(false);
            }}
          />
        </div>
      )}
    </fieldset>
  );
}
