"""Erwartete Abbrüche eines Jobs (fehlende Datei, fehlendes Argument, unbekannter Job).

Unterklasse von SystemExit: Auf der Kommandozeile endet der Aufruf wie bisher mit der
Meldung und Exit-Code 1. Der Scheduler fängt nur diese Klasse und lässt ein echtes
SystemExit (etwa beim Herunterfahren) durch.
"""


class JobError(SystemExit):
    pass
