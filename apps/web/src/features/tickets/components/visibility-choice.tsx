'use client';

import { type TicketVisibility, ticketVisibilitySchema } from '@trybun/contracts/tickets';
import { Alert, AlertDescription } from '@trybun/ui/components/alert';
import { Field, FieldLabel, FieldLegend, FieldSet, FieldTitle } from '@trybun/ui/components/field';
import { RadioGroup, RadioGroupItem } from '@trybun/ui/components/radio-group';
import { TriangleAlertIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Ref } from 'react';

/**
 * The visibility of an end user's ticket (§5.1, S1-11 Q14): a radio group of the options the API
 * allows – every option visible, one tap chooses it – and the warning of §5.1 while **All
 * customers** is chosen. `data-tour` marks it for the tour of S1-18.
 */
export function VisibilityChoice({
  options,
  value,
  onValueChange,
  disabled = false,
  name,
  inputRef,
}: {
  options: readonly TicketVisibility[];
  value: TicketVisibility;
  onValueChange: (value: TicketVisibility) => void;
  disabled?: boolean;
  name?: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const t = useTranslations('tickets');
  return (
    <FieldSet data-tour="ticket-form-visibility">
      <FieldLegend variant="label">{t('visibility.label')}</FieldLegend>
      <RadioGroup
        inputRef={inputRef}
        name={name}
        value={value}
        disabled={disabled}
        onValueChange={(next) => onValueChange(ticketVisibilitySchema.parse(next))}
      >
        {options.map((option) => (
          // A 44 px touch target below the desktop with a precise pointer (§2.9).
          <FieldLabel key={option} className="min-h-11 justify-center xl:pointer-fine:min-h-0">
            <Field orientation="horizontal">
              <RadioGroupItem value={option} />
              <FieldTitle>{t(`visibilities.${option}`)}</FieldTitle>
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
      {value === 'all_customers' && (
        <Alert variant="warning">
          <TriangleAlertIcon aria-hidden />
          <AlertDescription>{t('visibility.warning')}</AlertDescription>
        </Alert>
      )}
    </FieldSet>
  );
}
