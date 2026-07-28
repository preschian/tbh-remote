import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

class SessionStore {
  static const _clientId = 'client_id';
  static const _accountId = 'account_id';
  static const _accountToken = 'account_token';
  static const _deviceId = 'device_id';
  static const _mobileToken = 'mobile_token';
  static const _deviceName = 'device_name';
  static const _subStatus = 'sub_status';

  Future<String> ensureClientId() async {
    final prefs = await SharedPreferences.getInstance();
    var id = prefs.getString(_clientId);
    if (id == null || id.isEmpty) {
      id = const Uuid().v4();
      await prefs.setString(_clientId, id);
    }
    return id;
  }

  Future<void> saveAccount({
    required String accountId,
    required String accountToken,
    required String subscriptionStatus,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_accountId, accountId);
    await prefs.setString(_accountToken, accountToken);
    await prefs.setString(_subStatus, subscriptionStatus);
  }

  Future<void> savePairing({
    required String deviceId,
    required String mobileToken,
    String? deviceName,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_deviceId, deviceId);
    await prefs.setString(_mobileToken, mobileToken);
    if (deviceName != null) await prefs.setString(_deviceName, deviceName);
  }

  Future<void> clearPairing() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_deviceId);
    await prefs.remove(_mobileToken);
    await prefs.remove(_deviceName);
  }

  Future<String?> accountToken() async =>
      (await SharedPreferences.getInstance()).getString(_accountToken);

  Future<String?> deviceId() async =>
      (await SharedPreferences.getInstance()).getString(_deviceId);

  Future<String?> mobileToken() async =>
      (await SharedPreferences.getInstance()).getString(_mobileToken);

  Future<String?> deviceName() async =>
      (await SharedPreferences.getInstance()).getString(_deviceName);

  Future<String> subscriptionStatus() async =>
      (await SharedPreferences.getInstance()).getString(_subStatus) ?? 'none';

  Future<void> setSubscriptionStatus(String status) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_subStatus, status);
  }
}
