import {QueueTask} from './QueueTask';
import * as winston from 'winston';
import {GoogleDriveService} from '../../google/GoogleDriveService';
import {OAuth2Client} from 'google-auth-library/build/src/auth/oauth2client';
import {FileContentService} from '../../utils/FileContentService';
import {BufferWritable} from '../../utils/BufferWritable';
import {StringWritable} from '../../utils/StringWritable';
import {GoogleDocsService} from '../../google/GoogleDocsService';
import {SimpleFile} from '../../model/GoogleFile';

export class TaskFetchDocument extends QueueTask {
  private googleDocsService: GoogleDocsService;

  constructor(protected logger: winston.Logger,
              private googleDriveService: GoogleDriveService,
              private auth: OAuth2Client,
              private fileService: FileContentService,
              private file: SimpleFile) {
    super(logger);

    this.googleDocsService = new GoogleDocsService(this.logger);
  }

  async run(): Promise<QueueTask[]> {
    const odtPath = this.file.id + '.odt';
    const gdocPath = this.file.id + '.gdoc';

    if (await this.fileService.exists(odtPath) && await this.fileService.exists(gdocPath)) {
      return [];
    }

    const destOdt = new BufferWritable();
    const destJson = new StringWritable();

    await this.googleDriveService.exportDocument(
      this.auth,
      { id: this.file.id, mimeType: 'application/vnd.oasis.opendocument.text', name: this.file.name },
      destOdt);
    await this.googleDocsService.download(this.auth, this.file, destJson);

    await this.fileService.writeBuffer(odtPath, destOdt.getBuffer());
    // fs.writeFileSync(zipPath, destZip.getBuffer());
    await this.fileService.writeFile(gdocPath, destJson.getString());

/*
    const document = JSON.parse(destJson.getString());
    const images: DownloadFileImage[] = await extractDocumentImages(document);
*/

    // const unZipper = new UnZipper();
    // await unZipper.load(fs.readFileSync(odtPath));
    // const htmlImages = await extractXmlImagesOrder(unZipper.getXml());
    // const zipImages: ImageMeta[] = unZipper.getImages();
    // for (let imageNo = 0; imageNo < htmlImages.length; imageNo++) {
    //   const htmlImage = htmlImages[imageNo];
    //   const zipImage = zipImages.find(zipImage => zipImage.zipPath === htmlImage);
    //   if (zipImage && images[imageNo]) {
    //     images[imageNo].zipImage = zipImage;
    //   }
    // }

/*
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime,
      version: file.version,
      images
    };
*/
    return [];
  }

}
