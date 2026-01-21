import { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Chainhost Mail - End-to-End Encrypted Email',
  description: 'Free encrypted email for every ethscription name. Wallet authentication, RSA-AES encryption, plus addressing, and API access.',
}

export default function MailAboutPage() {
  redirect('/mail')
}
