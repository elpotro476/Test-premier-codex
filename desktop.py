"""Windowed desktop entry point bundled with Python by PyInstaller."""
import argparse
import json
import sys
import threading
import webbrowser
from pathlib import Path
from http.server import ThreadingHTTPServer
import app
from runtime_paths import user_data_dir


def run_desktop():
    import tkinter as tk
    from tkinter import messagebox
    root = tk.Tk()
    root.title('SEMIN Marketplace — Application locale')
    root.geometry('560x340')
    root.resizable(False, False)
    root.configure(bg='#f4f6f5')
    server = None
    try:
        data = user_data_dir()
        data.mkdir(parents=True, exist_ok=True)
        app.PROFILES = data / 'mappings.json'
        # Validate the configuration before starting; never silently overwrite a damaged file.
        app.profiles()
        server = ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        server.daemon_threads = True
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f'http://127.0.0.1:{server.server_port}'
        tk.Label(root, text='SEMIN', font=('Segoe UI', 28, 'bold'), fg='#153b3a', bg='#f4f6f5').pack(pady=(25, 2))
        tk.Label(root, text='Marketplace Template Manager', font=('Segoe UI', 15), fg='#153b3a', bg='#f4f6f5').pack()
        tk.Label(root, text='L’application est prête dans votre navigateur.\nGardez cette fenêtre ouverte pendant votre travail.\nVos fichiers sont traités uniquement sur cet ordinateur.',
                 font=('Segoe UI', 11), bg='#f4f6f5', fg='#37584a', justify='center').pack(pady=18)

        def open_browser():
            try:
                if not webbrowser.open(url):
                    raise RuntimeError('Aucun navigateur disponible')
            except Exception:
                messagebox.showinfo('Ouvrir l’application', f'Ouvrez cette adresse dans Edge ou Chrome :\n{url}', parent=root)

        tk.Button(root, text='Ouvrir l’application', command=open_browser, bg='#267358', fg='white', font=('Segoe UI', 11), padx=18, pady=8).pack()

        def close():
            if messagebox.askokcancel('Fermer SEMIN', 'Arrêter l’application ?\nLes correspondances enregistrées seront conservées.\nLes fichiers importés devront être réimportés.', parent=root):
                root.destroy()

        tk.Button(root, text='Fermer l’application', command=close, font=('Segoe UI', 10)).pack(pady=12)
        root.protocol('WM_DELETE_WINDOW', close)
        root.after(350, open_browser)
        root.mainloop()
    except Exception:
        messagebox.showerror('SEMIN — lancement impossible',
                             'Impossible de démarrer l’application.\nVérifiez les droits sur votre dossier utilisateur et le fichier\n%LOCALAPPDATA%\\SEMIN-Marketplace\\mappings.json.\nConservez une copie de ce fichier avant toute modification.', parent=root)
        root.destroy()
    finally:
        if server:
            server.shutdown()
            server.server_close()
        app.SESSIONS.clear()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--self-test', action='store_true')
    parser.add_argument('--data-dir', type=Path)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    if args.self_test:
        # Only build automation uses these options; no commands required by end users.
        from packaged_check import run_checks
        report = {'ok': False, 'frozen': bool(getattr(sys, 'frozen', False))}
        try:
            if args.data_dir is None or args.report is None:
                raise ValueError('Test directory and report are required')
            if sys.platform == 'win32':
                import tkinter as tk
                window = tk.Tk(); window.withdraw(); window.update(); window.destroy()
                report['tkinter'] = True
            report.update(run_checks(args.data_dir))
            report['ok'] = True
        except Exception as error:
            report['error'] = str(error)
        if args.report:
            args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        return 0 if report['ok'] else 1
    run_desktop()
    return 0


if __name__ == '__main__':
    sys.exit(main())
