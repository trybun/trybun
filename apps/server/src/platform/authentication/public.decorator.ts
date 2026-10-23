import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'trybun:isPublic';

/** Marks a controller or handler that requires no principal, e.g. health and signed webhooks. */
export const Public = (): ClassDecorator & MethodDecorator => SetMetadata(IS_PUBLIC, true);
