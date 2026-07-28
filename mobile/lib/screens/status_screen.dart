import 'dart:convert';

import 'package:flutter/material.dart';

import '../services/api.dart';
import '../services/live_socket.dart';
import '../services/session.dart';

class StatusScreen extends StatefulWidget {
  const StatusScreen({
    super.key,
    required this.api,
    required this.session,
    required this.onUnpaired,
  });

  final RemoteApi api;
  final SessionStore session;
  final VoidCallback onUnpaired;

  @override
  State<StatusScreen> createState() => _StatusScreenState();
}

class _StatusScreenState extends State<StatusScreen> {
  final _socket = LiveSocket();
  Map<String, dynamic>? _status;
  bool _pcOnline = false;
  String? _connection;
  String? _deviceName;

  @override
  void initState() {
    super.initState();
    _connect();
  }

  Future<void> _connect() async {
    final deviceId = await widget.session.deviceId();
    final token = await widget.session.mobileToken();
    _deviceName = await widget.session.deviceName();
    if (deviceId == null || token == null) {
      widget.onUnpaired();
      return;
    }
    setState(() => _connection = 'connecting…');
    _socket.onMessage = _onMessage;
    _socket.onError = (e) {
      if (mounted) setState(() => _connection = 'error: $e');
    };
    _socket.onDone = () {
      if (mounted) setState(() => _connection = 'disconnected');
    };
    try {
      await _socket.connect(deviceId: deviceId, mobileToken: token);
      if (mounted) setState(() => _connection = 'live');
    } catch (e) {
      if (mounted) setState(() => _connection = 'failed: $e');
    }
  }

  void _onMessage(Map<String, dynamic> msg) {
    final type = msg['type'];
    setState(() {
      if (type == 'status') {
        _status = msg;
      } else if (type == 'presence') {
        _pcOnline = msg['online'] == true;
      }
    });
  }

  Future<void> _unpair() async {
    final token = await widget.session.accountToken();
    final deviceId = await widget.session.deviceId();
    if (token != null && deviceId != null) {
      try {
        await widget.api.unpair(accountToken: token, deviceId: deviceId);
      } catch (_) {
        /* still clear local */
      }
    }
    await _socket.disconnect();
    await widget.session.clearPairing();
    widget.onUnpaired();
  }

  @override
  void dispose() {
    _socket.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final stage = _status?['stage'];
    final label = stage is Map ? stage['label']?.toString() : null;
    final auto = _status?['autoLoop'];

    return Scaffold(
      appBar: AppBar(
        title: Text(_deviceName ?? 'TBH Remote'),
        actions: [
          IconButton(
            tooltip: 'Unpair',
            onPressed: _unpair,
            icon: const Icon(Icons.link_off),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ListTile(
            title: const Text('Connection'),
            subtitle: Text(_connection ?? '—'),
            trailing: Icon(
              _pcOnline ? Icons.cloud_done : Icons.cloud_off,
              color: _pcOnline ? Colors.green : Colors.grey,
            ),
          ),
          const Divider(),
          ListTile(
            title: const Text('Stage'),
            subtitle: Text(label ?? 'Waiting for PC status…'),
          ),
          if (auto is Map)
            ListTile(
              title: const Text('Auto loop'),
              subtitle: Text(
                'enabled=${auto['enabled']} step=${auto['step'] ?? '—'}',
              ),
            ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilledButton.tonal(
                onPressed: _socket.isConnected
                    ? () => _socket.sendCommand('pause_loop')
                    : null,
                child: const Text('Pause loop'),
              ),
              FilledButton.tonal(
                onPressed: _socket.isConnected
                    ? () => _socket.sendCommand('resume_loop')
                    : null,
                child: const Text('Resume'),
              ),
              FilledButton.tonal(
                onPressed: _socket.isConnected
                    ? () => _socket.sendCommand('run_now')
                    : null,
                child: const Text('Run now'),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text('Raw status', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          SelectableText(
            _status == null ? '—' : const JsonEncoder.withIndent('  ').convert(_status),
            style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
          ),
        ],
      ),
    );
  }
}
