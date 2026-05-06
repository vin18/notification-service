export function serializePreference(preference: {
  id: string;
  userId: string;
  channel: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...preference,
    createdAt: preference.createdAt.toISOString(),
    updatedAt: preference.updatedAt.toISOString()
  };
}
