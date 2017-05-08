
import { SocketStream } from "../../common/comms/SocketStream";

export abstract class Command {
    abstract writeToStream(stream: SocketStream);
    abstract parseResponse<T>(data: Object): T;
}