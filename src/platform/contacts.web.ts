export const CAN_PICK_CONTACT = false;

export interface PickedContact {
  name: string;
  phone: string;
}

export async function pickContact(): Promise<PickedContact | 'denied' | null> {
  return null;
}
