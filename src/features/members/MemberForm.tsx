import { useId, useState, type Ref } from 'react';
import { Button, Input, SwatchPicker } from '@/components/ui';
import { LIMITS } from '@/lib/domain';
import { validateMember, type MemberFormErrors, type MemberInput } from './model';

export type MemberFormProps = {
  /** Starting values (edit). Omit for an empty add form. */
  initial?: MemberInput;
  /** Color used while the user hasn't picked one (add form: first unused swatch). */
  defaultColor: string;
  submitLabel: string;
  /** Called with the trimmed, validated values. The add form then resets itself. */
  onSubmit: (value: MemberInput) => void;
  onCancel?: () => void;
  nameRef?: Ref<HTMLInputElement>;
  autoFocus?: boolean;
};

const labelClass = 'mb-1 block text-meta text-subtle';
const errorClass = 'mt-1 text-meta text-danger-text';

/** Name (required), 8-swatch color and optional http(s) avatar URL. Used to add and to edit. */
export function MemberForm({
  initial,
  defaultColor,
  submitLabel,
  onSubmit,
  onCancel,
  nameRef,
  autoFocus,
}: MemberFormProps) {
  const id = useId();
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState<string | null>(initial?.color ?? null);
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatar_url ?? '');
  const [errors, setErrors] = useState<MemberFormErrors>({});

  return (
    <form
      noValidate
      aria-label={submitLabel === 'Add' ? 'Add member' : 'Edit member'}
      className="flex flex-col gap-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        const result = validateMember({ name, color: color ?? defaultColor, avatarUrl });
        if (!result.ok) {
          setErrors(result.errors);
          return;
        }
        setErrors({});
        onSubmit(result.value);
        if (!initial) {
          setName('');
          setColor(null);
          setAvatarUrl('');
        }
      }}
    >
      <div>
        <label htmlFor={`${id}-name`} className={labelClass}>
          Name
        </label>
        <Input
          ref={nameRef}
          id={`${id}-name`}
          value={name}
          maxLength={LIMITS.memberName}
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="e.g. Sam Rivera"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? `${id}-name-error` : undefined}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
          }}
        />
        {errors.name && (
          <p id={`${id}-name-error`} className={errorClass}>
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <span className={labelClass}>Color</span>
        <SwatchPicker label="Color" value={color ?? defaultColor} onChange={setColor} />
      </div>

      <div>
        <label htmlFor={`${id}-avatar`} className={labelClass}>
          Avatar URL <span className="font-normal">(optional)</span>
        </label>
        <Input
          id={`${id}-avatar`}
          type="url"
          inputMode="url"
          value={avatarUrl}
          autoComplete="off"
          placeholder="https://…"
          aria-invalid={errors.avatar_url ? true : undefined}
          aria-describedby={errors.avatar_url ? `${id}-avatar-error` : undefined}
          onChange={(e) => {
            setAvatarUrl(e.target.value);
            if (errors.avatar_url) setErrors((prev) => ({ ...prev, avatar_url: undefined }));
          }}
        />
        {errors.avatar_url && (
          <p id={`${id}-avatar-error`} className={errorClass}>
            {errors.avatar_url}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-1.5">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" size="sm">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
