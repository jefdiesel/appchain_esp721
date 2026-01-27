import { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Chainhost Mail - Email for Your On-Chain Identity',
  description: 'Email for chainhost names. Understand the security model - what we protect and what we cannot.',
}

export default function MailAboutPage() {
  redirect('/mail')
}
