import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';

import '../config.dart';
import '../services/api.dart';
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
  Timer? _timer;
  Map<String, dynamic>? _status;
  bool _pcOnline = false;
  String? _connection;
  String? _deviceName;
  String? _deviceId;
  String? _token;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    _deviceId = await widget.session.deviceId();
    _token = await widget.session.mobileToken();
    _deviceName = await widget.session.deviceName();
    if (_deviceId == null || _token == null) {
      widget.onUnpaired();
      return;
    }
    setState(() => _connection = 'polling…');
    await _tick();
    _timer = Timer.periodic(AppConfig.statusPollInterval, (_) => _tick());
  }

  Future<void> _tick() async {
    final deviceId = _deviceId;
    final token = _token;
    if (deviceId == null || token == null) return;
    try {
      final res = await widget.api.getStatus(token: token, deviceId: deviceId);
      if (!mounted) return;
      setState(() {
        _pcOnline = res['pcOnline'] == true;
        final status = res['status'];
        _status = status is Map<String, dynamic>
            ? status
            : status is Map
                ? Map<String, dynamic>.from(status)
                : null;
        _connection = 'ok · ${res['updatedAt'] ?? 'no status yet'}';
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _connection = '${e.statusCode}: ${e.message}');
    } catch (e) {
      if (!mounted) return;
      setState(() => _connection = 'error: $e');
    }
  }

  Future<void> _command(String name) async {
    final deviceId = _deviceId;
    final token = _token;
    if (deviceId == null || token == null || _sending) return;
    setState(() => _sending = true);
    try {
      await widget.api.enqueueCommand(
        token: token,
        deviceId: deviceId,
        name: name,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Queued $name')),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
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
    _timer?.cancel();
    await widget.session.clearPairing();
    widget.onUnpaired();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final stage = _status?['stage'];
    final label = stage is Map ? stage['label']?.toString() : null;
    final auto = _status?['autoLoop'];
    final canCommand = !_sending && _token != null;

    return Scaffold(
      appBar: AppBar(
        title: Text(_deviceName ?? 'TBH Remote'),
        actions: [
          IconButton(
            tooltip: 'Refresh now',
            onPressed: _tick,
            icon: const Icon(Icons.refresh),
          ),
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
                onPressed: canCommand ? () => _command('pause_loop') : null,
                child: const Text('Pause loop'),
              ),
              FilledButton.tonal(
                onPressed: canCommand ? () => _command('resume_loop') : null,
                child: const Text('Resume'),
              ),
              FilledButton.tonal(
                onPressed: canCommand ? () => _command('run_now') : null,
                child: const Text('Run now'),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text('Raw status', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          SelectableText(
            _status == null
                ? '—'
                : const JsonEncoder.withIndent('  ').convert(_status),
            style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
          ),
        ],
      ),
    );
  }
}
