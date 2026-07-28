/// Runtime config for the Flutter client.
class AppConfig {
  /// Local `wrangler dev` default. Override for staging/prod builds.
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://127.0.0.1:8787',
  );

  static String get wsBaseUrl {
    final uri = Uri.parse(apiBaseUrl);
    final scheme = uri.scheme == 'https' ? 'wss' : 'ws';
    return uri.replace(scheme: scheme).toString().replaceAll(RegExp(r'/$'), '');
  }
}
