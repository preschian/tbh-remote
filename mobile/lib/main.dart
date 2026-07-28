import 'package:flutter/material.dart';

import 'screens/pair_screen.dart';
import 'screens/paywall_screen.dart';
import 'screens/status_screen.dart';
import 'services/api.dart';
import 'services/session.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final session = SessionStore();
  final api = RemoteApi();
  await _bootstrap(api, session);
  runApp(TbhRemoteApp(api: api, session: session));
}

Future<void> _bootstrap(RemoteApi api, SessionStore session) async {
  final clientId = await session.ensureClientId();
  final existing = await session.accountToken();
  if (existing != null) return;
  try {
    final res = await api.bootstrap(clientId: clientId);
    await session.saveAccount(
      accountId: res['accountId'] as String,
      accountToken: res['accountToken'] as String,
      subscriptionStatus:
          (res['subscription'] as Map?)?['status']?.toString() ?? 'none',
    );
  } catch (_) {
    // Offline / worker down — UI still loads; actions will error clearly.
  }
}

class TbhRemoteApp extends StatelessWidget {
  const TbhRemoteApp({super.key, required this.api, required this.session});

  final RemoteApi api;
  final SessionStore session;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TBH Remote',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1B4332),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1B4332),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: HomeShell(api: api, session: session),
    );
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.api, required this.session});

  final RemoteApi api;
  final SessionStore session;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  bool _loading = true;
  bool _subscribed = false;
  bool _paired = false;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    final sub = await widget.session.subscriptionStatus();
    final deviceId = await widget.session.deviceId();
    final token = await widget.session.accountToken();
    if (token != null) {
      try {
        final me = await widget.api.me(accountToken: token);
        final remoteSub =
            (me['subscription'] as Map?)?['status']?.toString() ?? sub;
        await widget.session.setSubscriptionStatus(remoteSub);
        setState(() {
          _subscribed = remoteSub == 'active' || remoteSub == 'grace';
          _paired = deviceId != null;
          _loading = false;
        });
        return;
      } catch (_) {
        /* fall through to local */
      }
    }
    setState(() {
      _subscribed = sub == 'active' || sub == 'grace';
      _paired = deviceId != null;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (!_subscribed) {
      return PaywallScreen(
        onDevUnlock: () async {
          await widget.session.setSubscriptionStatus('active');
          // Dev unlock is local-only until RevenueCat webhook exists.
          // Pair claim still needs server-side active status in real envs.
          setState(() => _subscribed = true);
        },
      );
    }
    if (!_paired) {
      return PairScreen(
        api: widget.api,
        session: widget.session,
        onPaired: () => setState(() => _paired = true),
      );
    }
    return StatusScreen(
      api: widget.api,
      session: widget.session,
      onUnpaired: () => setState(() => _paired = false),
    );
  }
}
