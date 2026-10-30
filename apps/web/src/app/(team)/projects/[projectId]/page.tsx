import { redirect } from 'next/navigation.js';

/**
 * The address of a project, where an accepted project invitation lands (ADR 0009). Until the
 * project's home view exists (the end-user portal of S1-09, the team views of S1-13), it shows the
 * home page, as the landing without a project does (AQ4).
 */
export default function ProjectPage(): never {
  redirect('/');
}
