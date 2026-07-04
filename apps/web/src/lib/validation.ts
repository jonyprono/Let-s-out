export const isFieldValid = (value: string): boolean => {
  return value.trim().length >= 1;
};

export const isFieldEmpty = (value: string): boolean => {
  return value.trim().length === 0;
};
