from boa.interop.System.Runtime import Notify

def Main(operation, args):
    if operation == 'Hello':
        msg = args[0]
        return Hello(msg)

    return False


def Hello(msg):
    Notify([msg])
    return True