import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Classroom } from '../../classroom/schemas/classroom.schema';

export type DocDocument = DocEntity & Document;

@Schema()
export class DocEntity {
  @Prop()
  assignment_name: string;

  @Prop({ type: Types.ObjectId, ref: Classroom.name }) // 🔥 ref ต้องตรงกับ Classroom model
  classroom: Types.ObjectId;

  @Prop()
  user_id: string;

  @Prop()
  user_name: string;
}

export const DocSchema = SchemaFactory.createForClass(DocEntity);