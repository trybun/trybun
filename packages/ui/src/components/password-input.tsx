'use client';

import { cn } from 'cn';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ComponentProps } from 'react';

import { Button } from '@trybun/ui/components/button';
import { Input } from '@trybun/ui/components/input';

// The toggle replaces a second field for repeating the password (Rule 2). It is a toggle button
// with a fixed label and `aria-pressed`, a 44 px target like the input (§2.9). `disabled` is set on
// the PasswordInput, not only on its `Field`, so that it disables the toggle too.
function PasswordInput({
  className,
  disabled,
  ...props
}: Omit<ComponentProps<typeof Input>, 'type'>) {
  const t = useTranslations('ui.passwordInput');
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div data-slot="password-input" className="relative w-full">
      <Input
        type={isVisible ? 'text' : 'password'}
        disabled={disabled}
        className={cn('pr-11 xl:pointer-fine:pr-8 [&::-ms-reveal]:hidden', className)}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('show')}
        aria-pressed={isVisible}
        disabled={disabled}
        onClick={() => setIsVisible((visible) => !visible)}
        className="absolute inset-y-0 right-0 text-muted-foreground"
      >
        {isVisible ? <EyeOffIcon /> : <EyeIcon />}
      </Button>
    </div>
  );
}

export { PasswordInput };
