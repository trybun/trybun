import { AppError } from '../../../platform/errors/app-error.js';

/**
 * Why the drafts of a link were not all linked (§13.3, Q4, Q11), decided after the link was rolled
 * back: an ID that is not an attachment the principal can read – another person's draft included –
 * answers `404 request.not_found`, before any other error (§17.2, order of checks); otherwise the
 * first ID that was not linked is an attachment already linked to a ticket,
 * `422 attachment.already_linked` at its pointer.
 */
export function linkFailure(
  requestedIds: readonly string[],
  linkedIds: ReadonlySet<string>,
  readableIds: ReadonlySet<string>,
): AppError {
  const unlinked = requestedIds.flatMap((id, index) => (linkedIds.has(id) ? [] : [{ id, index }]));
  if (unlinked.some(({ id }) => !readableIds.has(id))) {
    return new AppError('request.not_found');
  }
  const first = unlinked[0];
  if (first === undefined) {
    throw new Error('A link whose drafts were all linked did not fail');
  }
  return new AppError('attachment.already_linked', [
    { pointer: `/attachmentIds/${first.index}`, code: 'field.invalid' },
  ]);
}
