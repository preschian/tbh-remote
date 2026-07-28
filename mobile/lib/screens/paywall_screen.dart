import 'package:flutter/material.dart';

/// Placeholder until RevenueCat is wired (phase 2).
class PaywallScreen extends StatelessWidget {
  const PaywallScreen({super.key, required this.onDevUnlock});

  /// Local/dev only: pretend subscription is active.
  final VoidCallback onDevUnlock;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Subscribe')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'TBH Remote needs a subscription to cover the Cloudflare relay.',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            const Text(
              'RevenueCat + App Store / Play products will live here. '
              'For now you can unlock in debug builds to exercise pairing.',
            ),
            const Spacer(),
            FilledButton(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('IAP not configured yet')),
                );
              },
              child: const Text('Subscribe (coming soon)'),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: onDevUnlock,
              child: const Text('Dev: mark subscription active'),
            ),
          ],
        ),
      ),
    );
  }
}
