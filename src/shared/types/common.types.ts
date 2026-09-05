export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface AsyncState<T> {
  data: T;
  isLoading: boolean;
  error: string | null;
}
