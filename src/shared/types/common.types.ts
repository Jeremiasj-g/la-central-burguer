export interface SelectOption {
  label: string;
  value: string;
}

export interface AsyncState<T> {
  data: T;
  isLoading: boolean;
  error: string | null;
}
