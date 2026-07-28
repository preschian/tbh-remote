import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import '../config.dart';

typedef JsonHandler = void Function(Map<String, dynamic> message);

/// Thin WSS client for DeviceRoom.
class LiveSocket {
  WebSocketChannel? _channel;
  StreamSubscription? _sub;
  JsonHandler? onMessage;
  void Function(Object error)? onError;
  void Function()? onDone;

  bool get isConnected => _channel != null;

  Future<void> connect({
    required String deviceId,
    required String mobileToken,
  }) async {
    await disconnect();
    final uri = Uri.parse(
      '${AppConfig.wsBaseUrl}/v1/ws'
      '?role=mobile&deviceId=${Uri.encodeQueryComponent(deviceId)}'
      '&token=${Uri.encodeQueryComponent(mobileToken)}',
    );
    final channel = WebSocketChannel.connect(uri);
    _channel = channel;
    channel.sink.add(jsonEncode({'type': 'hello', 'protocol': 1}));
    _sub = channel.stream.listen(
      (event) {
        if (event is! String) return;
        try {
          final map = jsonDecode(event) as Map<String, dynamic>;
          onMessage?.call(map);
        } catch (_) {
          /* ignore malformed */
        }
      },
      onError: (Object e) => onError?.call(e),
      onDone: () {
        _channel = null;
        onDone?.call();
      },
    );
  }

  void send(Map<String, dynamic> message) {
    _channel?.sink.add(jsonEncode(message));
  }

  void sendCommand(String name, {Map<String, dynamic>? args}) {
    send({
      'type': 'command',
      'id': DateTime.now().microsecondsSinceEpoch.toString(),
      'name': name,
      'args': ?args,
      'expiresAt': DateTime.now()
          .toUtc()
          .add(const Duration(seconds: 60))
          .toIso8601String(),
    });
  }

  Future<void> disconnect() async {
    await _sub?.cancel();
    _sub = null;
    await _channel?.sink.close();
    _channel = null;
  }
}
