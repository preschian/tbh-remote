import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/api.dart';
import '../services/session.dart';

class PairScreen extends StatefulWidget {
  const PairScreen({
    super.key,
    required this.api,
    required this.session,
    required this.onPaired,
  });

  final RemoteApi api;
  final SessionStore session;
  final VoidCallback onPaired;

  @override
  State<PairScreen> createState() => _PairScreenState();
}

class _PairScreenState extends State<PairScreen> {
  final _code = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _claim() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final token = await widget.session.accountToken();
      if (token == null) throw ApiException(401, 'unauthorized', 'No account');
      final res = await widget.api.claimPair(
        accountToken: token,
        code: _code.text.trim(),
      );
      await widget.session.savePairing(
        deviceId: res['deviceId'] as String,
        mobileToken: res['mobileToken'] as String,
        deviceName: res['deviceName'] as String?,
      );
      if (!mounted) return;
      widget.onPaired();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pair PC')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(
            'Open TBH Companion on your PC → Status & Settings → show pairing code.',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 24),
          TextField(
            controller: _code,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: '6-digit code',
              border: OutlineInputBorder(),
            ),
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(6),
            ],
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _busy || _code.text.trim().length != 6 ? null : _claim,
            child: _busy
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Pair'),
          ),
          const SizedBox(height: 12),
          Text(
            'Requires an active subscription on the server.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
