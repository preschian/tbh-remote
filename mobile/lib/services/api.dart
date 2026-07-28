import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config.dart';

class ApiException implements Exception {
  ApiException(this.statusCode, this.code, this.message);
  final int statusCode;
  final String code;
  final String message;

  @override
  String toString() => 'ApiException($statusCode $code: $message)';
}

class RemoteApi {
  RemoteApi({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;
  final _base = AppConfig.apiBaseUrl;

  Future<Map<String, dynamic>> bootstrap({required String clientId}) async {
    return _post('/v1/accounts/bootstrap', body: {'clientId': clientId});
  }

  Future<Map<String, dynamic>> me({required String accountToken}) async {
    return _get('/v1/me', token: accountToken);
  }

  Future<Map<String, dynamic>> claimPair({
    required String accountToken,
    required String code,
  }) async {
    return _post(
      '/v1/pair/claim',
      token: accountToken,
      body: {'code': code},
    );
  }

  Future<void> unpair({
    required String accountToken,
    required String deviceId,
  }) async {
    await _delete('/v1/devices/$deviceId', token: accountToken);
  }

  Future<Map<String, dynamic>> getStatus({
    required String token,
    required String deviceId,
  }) async {
    return _get('/v1/devices/$deviceId/status', token: token);
  }

  Future<Map<String, dynamic>> enqueueCommand({
    required String token,
    required String deviceId,
    required String name,
    Map<String, dynamic>? args,
  }) async {
    return _post(
      '/v1/devices/$deviceId/commands',
      token: token,
      body: {
        'name': name,
        'args': ?args,
      },
    );
  }

  Future<Map<String, dynamic>> _get(String path, {String? token}) async {
    final res = await _client.get(
      Uri.parse('$_base$path'),
      headers: _headers(token),
    );
    return _decode(res);
  }

  Future<Map<String, dynamic>> _post(
    String path, {
    String? token,
    Map<String, dynamic>? body,
  }) async {
    final res = await _client.post(
      Uri.parse('$_base$path'),
      headers: _headers(token),
      body: body == null ? null : jsonEncode(body),
    );
    return _decode(res);
  }

  Future<void> _delete(String path, {String? token}) async {
    final res = await _client.delete(
      Uri.parse('$_base$path'),
      headers: _headers(token),
    );
    _decode(res);
  }

  Map<String, String> _headers(String? token) {
    return {
      'content-type': 'application/json',
      if (token != null) 'authorization': 'Bearer $token',
    };
  }

  Map<String, dynamic> _decode(http.Response res) {
    final map = res.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 400) {
      final err = map['error'] as Map<String, dynamic>?;
      throw ApiException(
        res.statusCode,
        err?['code']?.toString() ?? 'error',
        err?['message']?.toString() ?? res.body,
      );
    }
    return map;
  }
}
