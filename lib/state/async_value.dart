/// Trạng thái dữ liệu bất đồng bộ dùng chung cho các notifier theo màn
/// (loading / data / error). Đủ nhẹ, không kéo thêm package.
sealed class AsyncValue<T> {
  const AsyncValue();
}

class AsyncLoading<T> extends AsyncValue<T> {
  const AsyncLoading();
}

class AsyncData<T> extends AsyncValue<T> {
  const AsyncData(this.value);
  final T value;
}

class AsyncError<T> extends AsyncValue<T> {
  const AsyncError(this.error);
  final Object error;
}
