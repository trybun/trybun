import type { Meta, StoryObj } from '@storybook/react-vite';
import { PencilIcon, TrashIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { expect, fn, screen, waitFor } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Button } from './button.js';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu.js';

const onEdit = fn();

const meta = {
  title: 'Components/DropdownMenu',
  component: DropdownMenu,
  render: (args: ComponentProps<typeof DropdownMenu>) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger render={<Button variant="outline" />}>Actions</DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Ticket</DropdownMenuLabel>
          <DropdownMenuItem onClick={onEdit}>
            <PencilIcon aria-hidden="true" />
            Edit
            <DropdownMenuShortcut>E</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem defaultChecked>Watching</DropdownMenuCheckboxItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Backlog</DropdownMenuItem>
              <DropdownMenuItem>In progress</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Priority</DropdownMenuLabel>
          <DropdownMenuRadioGroup defaultValue="normal">
            <DropdownMenuRadioItem value="normal">Normal</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="high">High</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <TrashIcon aria-hidden="true" />
          Delete
        </DropdownMenuItem>
        <DropdownMenuItem disabled>Merge</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
} satisfies Meta<typeof DropdownMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Edit/ }));
    await expect(onEdit).toHaveBeenCalledOnce();
  },
};

export const Open: Story = { args: { defaultOpen: true } };

// Items are 44 px high on phones and tablets (§2.9).
export const Phone: Story = {
  args: { defaultOpen: true },
  globals: viewport('phone'),
  play: async () => {
    await screen.findAllByRole('menuitem');
    const items = ['menuitem', 'menuitemcheckbox', 'menuitemradio'].flatMap((role) =>
      screen.getAllByRole(role),
    );
    // After the zoom-in animation of the popup.
    await waitFor(() => {
      for (const item of items) {
        expect(item.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      }
    });
  },
};

export const Tablet: Story = {
  args: { defaultOpen: true },
  globals: viewport('tablet'),
  play: Phone.play,
};

export const Desktop: Story = { args: { defaultOpen: true }, globals: viewport('desktop') };
