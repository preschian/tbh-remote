/// Runtime config for the Flutter client.
class AppConfig {
  /// Local `wrangler dev` default. Override for staging/prod builds.
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://127.0.0.1:8787',
  );

  static const statusPollInterval = Duration(seconds: 3);
}
