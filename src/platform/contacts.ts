import { Contact, requestPermissionsAsync } from 'expo-contacts';

export const CAN_PICK_CONTACT = true;

export interface PickedContact {
  name: string;
  phone: string;
}

/** Opens the phone's own contact list. Returns 'denied' if permission is refused, null if cancelled. */
export async function pickContact(): Promise<PickedContact | 'denied' | null> {
  const permission = await requestPermissionsAsync();
  if (!permission.granted) return 'denied';
  const contact = await Contact.presentPicker();
  if (!contact) return null;
  const [name, phones] = await Promise.all([contact.getFullName(), contact.getPhones()]);
  return { name: (name ?? '').trim(), phone: (phones[0]?.number ?? '').trim() };
}
